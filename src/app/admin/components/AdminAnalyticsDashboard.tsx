'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area, PieChart, Pie, Cell, LineChart, Line,  } from 'recharts';

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

interface ContactInquiry {
  id: string;
  name: string;
  email: string;
  booking_stage: string;
  created_at: string;
  practice_area?: string;
}

interface DailyPoint {
  date: string;
  bookings: number;
  portalBookings: number;
  revenue: number;
  leads: number;
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

// ─── Constants ────────────────────────────────────────────────────────────────

const BOOKING_TYPES_LIST = [
  { key: 'initial_consultation', label: 'Initial Consultation' },
  { key: 'case_checkin', label: 'Case Check-In' },
  { key: 'follow_up', label: 'Follow-Up Meeting' },
  { key: 'document_review', label: 'Document Review' },
];

const ACCENT = '#355E3B';
const GOLD = '#8B6020';
const CHART_COLORS = ['#355E3B', '#4a7c59', '#6b9e7a', '#8dbf9a', '#afd9ba', '#8B6020', '#C8965A'];
const PIE_COLORS = ['#355E3B', '#8B6020', '#4a7c59', '#C8965A', '#6b9e7a', '#e8a838', '#afd9ba'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

function dayLabel(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function dayLabelFromDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function pct(num: number, denom: number) {
  return denom > 0 ? Math.round((num / denom) * 100) : 0;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon, accent = false, warn = false, trend,
}: {
  label: string; value: string; sub?: string; icon: React.ReactNode;
  accent?: boolean; warn?: boolean; trend?: { value: number; label: string };
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
      <div className="flex items-center justify-between gap-2">
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        {trend && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
            trend.value > 0 ? 'bg-emerald-100 text-emerald-700' : trend.value < 0 ? 'bg-red-100 text-red-600' : 'bg-secondary text-muted-foreground'
          }`}>
            {trend.value > 0 ? '↑' : trend.value < 0 ? '↓' : '→'} {Math.abs(trend.value)}% {trend.label}
          </span>
        )}
      </div>
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

// ─── Insight Card ─────────────────────────────────────────────────────────────

function InsightCard({ icon, title, value, detail, color }: {
  icon: React.ReactNode; title: string; value: string; detail: string; color: string;
}) {
  return (
    <div className={`rounded-2xl border p-4 flex items-start gap-3 ${color}`}>
      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-white/60">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-widest opacity-70 mb-0.5">{title}</p>
        <p className="text-xl font-bold leading-none mb-1">{value}</p>
        <p className="text-xs opacity-70">{detail}</p>
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
  const [leads, setLeads] = useState<ContactInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [range, setRange] = useState<7 | 14 | 30>(30);
  const [activeTab, setActiveTab] = useState<'overview' | 'bookings' | 'revenue' | 'email' | 'leads' | 'legislation'>('overview');
  const [legislationStats, setLegislationStats] = useState<{
    totalSaved: number;
    highPriority: number;
    withSummaries: number;
    researchSessions: number;
    byPracticeArea: { name: string; value: number }[];
    byUrgency: { name: string; value: number }[];
    recentSaved: { title: string; urgency: string; relevance_score: number; created_at: string }[];
  } | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const since = new Date();
      since.setDate(since.getDate() - range);
      const sinceISO = since.toISOString();
      const sinceDateStr = sinceISO.split('T')[0];

      const [bRes, cbRes, pRes, sRes, rRes, prRes, inRes, lRes] = await Promise.all([
        supabase.from('calendly_bookings').select('id, status, start_time, created_at').gte('created_at', sinceISO).order('created_at', { ascending: true }),
        supabase.from('consultation_bookings').select('id, status, booking_date, booking_time, booking_type, client_name, client_email, confirmation_sent, created_at').gte('booking_date', sinceDateStr).order('booking_date', { ascending: true }),
        supabase.from('payments').select('id, amount, currency, payment_status, payment_type, customer_name, created_at').gte('created_at', sinceISO).order('created_at', { ascending: true }),
        supabase.from('email_sequences').select('id, send_status, sequence_type, scheduled_at, sent_at').gte('created_at', sinceISO),
        supabase.from('payment_reminder_sequences').select('id, send_status, scheduled_at, sent_at').gte('created_at', sinceISO),
        supabase.from('prospect_followup_sequences').select('id, send_status, scheduled_at, sent_at').gte('created_at', sinceISO),
        supabase.from('intake_nurture_sequences').select('id, send_status, scheduled_at, sent_at').gte('created_at', sinceISO),
        supabase.from('contact_inquiries').select('id, name, email, booking_stage, created_at, practice_area').gte('created_at', sinceISO).order('created_at', { ascending: true }),
      ]);

      setBookings((bRes.data as Booking[]) ?? []);
      setConsultationBookings((cbRes.data as ConsultationBooking[]) ?? []);
      setPayments((pRes.data as Payment[]) ?? []);
      setSequences((sRes.data as EmailSeq[]) ?? []);
      setReminders((rRes.data as Reminder[]) ?? []);
      setProspectEmails((prRes.data as ProspectEmail[]) ?? []);
      setIntakeNurture((inRes.data as IntakeNurture[]) ?? []);
      setLeads((lRes.data as ContactInquiry[]) ?? []);

      // Fetch legislation stats
      const [legSavedRes, legHistoryRes] = await Promise.all([
        supabase.from('legislation_saved_bills').select('title, urgency, relevance_score, practice_areas, ai_summary, created_at').order('created_at', { ascending: false }).limit(50),
        supabase.from('lexi_research_history').select('id').limit(100),
      ]);
      const legSaved = (legSavedRes.data as { title: string; urgency: string; relevance_score: number; practice_areas: string[]; ai_summary: string; created_at: string }[]) ?? [];
      const practiceAreaMap: Record<string, number> = {};
      legSaved.forEach((b) => {
        (b.practice_areas || []).forEach((area: string) => {
          practiceAreaMap[area] = (practiceAreaMap[area] ?? 0) + 1;
        });
      });
      const urgencyMap: Record<string, number> = { high: 0, medium: 0, low: 0 };
      legSaved.forEach((b) => { if (b.urgency) urgencyMap[b.urgency] = (urgencyMap[b.urgency] ?? 0) + 1; });
      setLegislationStats({
        totalSaved: legSaved.length,
        highPriority: legSaved.filter((b) => b.urgency === 'high').length,
        withSummaries: legSaved.filter((b) => b.ai_summary).length,
        researchSessions: (legHistoryRes.data ?? []).length,
        byPracticeArea: Object.entries(practiceAreaMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6),
        byUrgency: Object.entries(urgencyMap).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value })),
        recentSaved: legSaved.slice(0, 5),
      });

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
  const cancelRate = pct(canceledBookings.length, bookings.length);

  const confirmedPortalBookings = consultationBookings.filter((b) => b.status === 'confirmed' || b.status === 'completed');
  const cancelledPortalBookings = consultationBookings.filter((b) => b.status === 'cancelled');
  const pendingPortalBookings = consultationBookings.filter((b) => b.status === 'pending');
  const confirmationsSent = consultationBookings.filter((b) => b.confirmation_sent).length;
  const portalCancelRate = pct(cancelledPortalBookings.length, consultationBookings.length);

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
  const failedRevenue = payments
    .filter((p) => p.payment_status === 'failed')
    .reduce((s, p) => s + p.amount / 100, 0);
  const avgPayment = payments.filter((p) => p.payment_status === 'succeeded' || p.payment_status === 'paid').length > 0
    ? collectedRevenue / payments.filter((p) => p.payment_status === 'succeeded' || p.payment_status === 'paid').length
    : 0;

  const allEmails = [...sequences, ...reminders, ...prospectEmails, ...intakeNurture];
  const totalEmailSent = allEmails.filter((e) => e.send_status === 'sent').length;
  const totalEmailFailed = allEmails.filter((e) => e.send_status === 'failed').length;
  const overallDeliveryRate = pct(totalEmailSent, allEmails.length);

  // Lead funnel
  const totalLeads = leads.length;
  const activeLeads = leads.filter((l) => l.booking_stage === 'active_client').length;
  const consultationLeads = leads.filter((l) => l.booking_stage === 'consultation_booked').length;
  const proposalLeads = leads.filter((l) => l.booking_stage === 'proposal_sent').length;
  const conversionRate = pct(activeLeads, totalLeads);

  // Practice area breakdown
  const practiceAreaMap: Record<string, number> = {};
  leads.forEach((l) => {
    const area = l.practice_area || 'General';
    practiceAreaMap[area] = (practiceAreaMap[area] ?? 0) + 1;
  });
  const practiceAreaData = Object.entries(practiceAreaMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  // ── Daily trend ──────────────────────────────────────────────────────────────

  const dailyData: DailyPoint[] = (() => {
    const map: Record<string, { bookings: number; portalBookings: number; revenue: number; leads: number }> = {};
    const now = new Date();
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      map[dayLabel(d.toISOString())] = { bookings: 0, portalBookings: 0, revenue: 0, leads: 0 };
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
    leads.forEach((l) => {
      const k = dayLabel(l.created_at);
      if (map[k]) map[k].leads += 1;
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
      rate: pct(sequences.filter((e) => e.send_status === 'sent').length, sequences.length),
    },
    {
      channel: 'Payment Reminders',
      sent: reminders.filter((e) => e.send_status === 'sent').length,
      failed: reminders.filter((e) => e.send_status === 'failed').length,
      pending: reminders.filter((e) => e.send_status === 'pending').length,
      skipped: reminders.filter((e) => e.send_status === 'skipped').length,
      total: reminders.length,
      rate: pct(reminders.filter((e) => e.send_status === 'sent').length, reminders.length),
    },
    {
      channel: 'Prospect Follow-Ups',
      sent: prospectEmails.filter((e) => e.send_status === 'sent').length,
      failed: prospectEmails.filter((e) => e.send_status === 'failed').length,
      pending: prospectEmails.filter((e) => e.send_status === 'pending').length,
      skipped: prospectEmails.filter((e) => e.send_status === 'skipped').length,
      total: prospectEmails.length,
      rate: pct(prospectEmails.filter((e) => e.send_status === 'sent').length, prospectEmails.length),
    },
    {
      channel: 'Intake Nurture',
      sent: intakeNurture.filter((e) => e.send_status === 'sent').length,
      failed: intakeNurture.filter((e) => e.send_status === 'failed').length,
      pending: intakeNurture.filter((e) => e.send_status === 'pending').length,
      skipped: intakeNurture.filter((e) => e.send_status === 'skipped').length,
      total: intakeNurture.length,
      rate: pct(intakeNurture.filter((e) => e.send_status === 'sent').length, intakeNurture.length),
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

  // Payment status pie
  const paymentStatusPie = [
    { name: 'Collected', value: payments.filter((p) => p.payment_status === 'succeeded' || p.payment_status === 'paid').length },
    { name: 'Pending', value: payments.filter((p) => p.payment_status === 'pending' || p.payment_status === 'processing').length },
    { name: 'Failed', value: payments.filter((p) => p.payment_status === 'failed').length },
  ].filter((d) => d.value > 0);

  // Lead stage funnel
  const leadFunnelData = [
    { stage: 'New Leads', count: totalLeads },
    { stage: 'Consultation', count: consultationLeads },
    { stage: 'Proposal Sent', count: proposalLeads },
    { stage: 'Active Client', count: activeLeads },
  ];

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

  const TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'bookings', label: 'Bookings' },
    { key: 'revenue', label: 'Revenue' },
    { key: 'email', label: 'Email' },
    { key: 'leads', label: 'Leads' },
    { key: 'legislation', label: '⚖️ Legislation' },
  ] as const;

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
        <div className="flex items-center gap-2 flex-wrap">
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

      {/* ── Tab Navigation ── */}
      <div className="flex items-center gap-1 bg-secondary/30 rounded-2xl p-1 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all ${
              activeTab === tab.key
                ? 'bg-card text-foreground shadow-sm border border-border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── KPI Summary Cards (always visible) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard
          label={`Bookings (${range}d)`}
          value={totalAllBookings.toString()}
          sub={`${bookings.length} Calendly · ${consultationBookings.length} portal`}
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>}
        />
        <StatCard
          label={`Revenue (${range}d)`}
          value={fmt(collectedRevenue)}
          sub={pendingRevenue > 0 ? `${fmt(pendingRevenue)} pending` : `Avg ${fmt(avgPayment)}`}
          accent={collectedRevenue > 0}
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>}
        />
        <StatCard
          label="Email Delivery"
          value={`${overallDeliveryRate}%`}
          sub={`${totalEmailSent} sent · ${totalEmailFailed} failed`}
          accent={overallDeliveryRate >= 80}
          warn={overallDeliveryRate < 80 && overallDeliveryRate >= 50}
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>}
        />
        <StatCard
          label={`New Leads (${range}d)`}
          value={totalLeads.toString()}
          sub={`${conversionRate}% conversion rate`}
          accent={totalLeads > 0}
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>}
        />
        <StatCard
          label="Cancel Rate"
          value={`${cancelRate}%`}
          sub={`${canceledBookings.length} of ${bookings.length} Calendly`}
          warn={cancelRate > 20}
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>}
        />
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Insights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <InsightCard
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>}
              title="Avg Revenue / Booking"
              value={totalAllBookings > 0 ? fmt(collectedRevenue / totalAllBookings) : '$0'}
              detail="Collected revenue per booking"
              color="bg-emerald-50 border-emerald-200 text-emerald-800"
            />
            <InsightCard
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>}
              title="Lead → Client Rate"
              value={`${conversionRate}%`}
              detail={`${activeLeads} active of ${totalLeads} leads`}
              color="bg-amber-50 border-amber-200 text-amber-800"
            />
            <InsightCard
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>}
              title="Email Engagement"
              value={`${overallDeliveryRate}%`}
              detail={`${allEmails.length} total emails tracked`}
              color="bg-violet-50 border-violet-200 text-violet-800"
            />
            <InsightCard
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0369a1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>}
              title="Confirmation Rate"
              value={`${pct(confirmationsSent, consultationBookings.length)}%`}
              detail={`${confirmationsSent} of ${consultationBookings.length} portal bookings`}
              color="bg-sky-50 border-sky-200 text-sky-800"
            />
          </div>

          {/* Daily Trend */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h3 className="font-serif text-lg text-foreground mb-1">Activity Trend</h3>
                <p className="text-xs text-muted-foreground">Bookings, leads, and revenue — last {range} days</p>
              </div>
            </div>
            {dailyData.every((d) => d.bookings === 0 && d.portalBookings === 0 && d.revenue === 0 && d.leads === 0) ? (
              <div className="py-12 text-center text-sm text-muted-foreground">No activity in this period.</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={dailyData} margin={{ top: 4, right: 0, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradBookings" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={ACCENT} stopOpacity={0.18} />
                      <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradLeads" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={GOLD} stopOpacity={0.18} />
                      <stop offset="95%" stopColor={GOLD} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS[2]} stopOpacity={0.18} />
                      <stop offset="95%" stopColor={CHART_COLORS[2]} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} interval={range === 7 ? 0 : range === 14 ? 1 : 4} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} width={40} />
                  <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }} formatter={(value: number, name: string) => name === 'Revenue' ? [fmt(value), name] : [value, name]} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }} />
                  <Area yAxisId="left" type="monotone" dataKey="bookings" name="Calendly" stroke={ACCENT} strokeWidth={2} fill="url(#gradBookings)" dot={false} />
                  <Area yAxisId="left" type="monotone" dataKey="leads" name="Leads" stroke={GOLD} strokeWidth={2} fill="url(#gradLeads)" dot={false} />
                  <Area yAxisId="right" type="monotone" dataKey="revenue" name="Revenue" stroke={CHART_COLORS[2]} strokeWidth={2} fill="url(#gradRevenue)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* ── BOOKINGS TAB ── */}
      {activeTab === 'bookings' && (
        <div className="space-y-6">
          {/* Portal Booking Metrics */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h3 className="font-serif text-lg text-foreground mb-1">Portal Consultation Bookings</h3>
                <p className="text-xs text-muted-foreground">Direct bookings from the client portal — last {range} days</p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Live
              </span>
            </div>
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
            <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'rgba(53,94,59,0.05)', border: '1px solid rgba(53,94,59,0.15)' }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(53,94,59,0.12)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Confirmation Emails Sent</p>
                  <p className="text-xs text-muted-foreground">{confirmationsSent} of {consultationBookings.length} bookings</p>
                </div>
              </div>
              <p className="text-2xl font-bold" style={{ color: '#355E3B' }}>
                {pct(confirmationsSent, consultationBookings.length)}%
              </p>
            </div>
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
                            : b.status === 'pending' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-red-100 text-red-600 border-red-200';
                        const typeLabel = BOOKING_TYPES_LIST.find((t) => t.key === b.booking_type)?.label ?? b.booking_type;
                        return (
                          <tr key={b.id} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                            <td className="px-4 py-3 font-medium text-foreground">{b.client_name}</td>
                            <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell text-xs">{typeLabel}</td>
                            <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(b.booking_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                            <td className="px-4 py-3"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border capitalize ${statusColor}`}>{b.status}</span></td>
                            <td className="px-4 py-3 text-center hidden md:table-cell">
                              {b.confirmation_sent ? (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto"><polyline points="20 6 9 17 4 12" /></svg>
                              ) : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
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

          {/* Calendly Status */}
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
        </div>
      )}

      {/* ── REVENUE TAB ── */}
      {activeTab === 'revenue' && (
        <div className="space-y-6">
          {/* Revenue summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Collected', value: fmt(collectedRevenue), color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
              { label: 'Pending', value: fmt(pendingRevenue), color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
              { label: 'Failed', value: fmt(failedRevenue), color: 'text-red-500', bg: 'bg-red-50 border-red-200' },
            ].map((item) => (
              <div key={item.label} className={`border rounded-2xl p-5 ${item.bg}`}>
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">{item.label}</p>
                <p className={`text-3xl font-bold ${item.color}`}>{item.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue by type */}
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

            {/* Payment status pie */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <h3 className="font-serif text-lg text-foreground mb-1">Payment Status Mix</h3>
              <p className="text-xs text-muted-foreground mb-5">Distribution of payment outcomes</p>
              {paymentStatusPie.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">No payments in this period.</div>
              ) : (
                <div className="flex items-center gap-6">
                  <ResponsiveContainer width="50%" height={180}>
                    <PieChart>
                      <Pie data={paymentStatusPie} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                        {paymentStatusPie.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col gap-2">
                    {paymentStatusPie.map((item, index) => (
                      <div key={item.name} className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[index % PIE_COLORS.length] }} />
                        <span className="text-xs text-muted-foreground">{item.name}</span>
                        <span className="text-xs font-semibold text-foreground ml-auto">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Revenue trend line */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h3 className="font-serif text-lg text-foreground mb-1">Revenue Trend</h3>
            <p className="text-xs text-muted-foreground mb-5">Daily collected revenue — last {range} days</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={dailyData} margin={{ top: 4, right: 0, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} interval={range === 7 ? 0 : range === 14 ? 1 : 4} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} width={40} />
                <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }} formatter={(v: number) => [fmt(v), 'Revenue']} />
                <Line type="monotone" dataKey="revenue" name="Revenue" stroke={GOLD} strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Recent Payments Table */}
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
                          : p.payment_status === 'pending' || p.payment_status === 'processing' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-red-100 text-red-600 border-red-200';
                      return (
                        <tr key={p.id} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                          <td className="px-6 py-3.5 font-medium text-foreground">{p.customer_name || '—'}</td>
                          <td className="px-6 py-3.5 text-right font-semibold text-foreground">{fmt(p.amount / 100)}</td>
                          <td className="px-6 py-3.5 text-muted-foreground capitalize hidden sm:table-cell">{p.payment_type || '—'}</td>
                          <td className="px-6 py-3.5"><span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${statusColor}`}>{p.payment_status}</span></td>
                          <td className="px-6 py-3.5 text-muted-foreground text-right hidden md:table-cell">{new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── EMAIL TAB ── */}
      {activeTab === 'email' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Total Sent', value: totalEmailSent.toString(), color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
              { label: 'Failed', value: totalEmailFailed.toString(), color: 'text-red-500', bg: 'bg-red-50 border-red-200' },
              { label: 'Delivery Rate', value: `${overallDeliveryRate}%`, color: overallDeliveryRate >= 80 ? 'text-emerald-600' : 'text-amber-600', bg: 'bg-secondary/30 border-border' },
            ].map((item) => (
              <div key={item.label} className={`border rounded-2xl p-5 ${item.bg}`}>
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">{item.label}</p>
                <p className={`text-3xl font-bold ${item.color}`}>{item.value}</p>
              </div>
            ))}
          </div>

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

          {/* Email volume bar chart */}
          {channels.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-6">
              <h3 className="font-serif text-lg text-foreground mb-1">Channel Volume Comparison</h3>
              <p className="text-xs text-muted-foreground mb-5">Total emails per channel</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={channels} margin={{ top: 0, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="channel" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }} />
                  <Bar dataKey="sent" name="Sent" fill={ACCENT} radius={[4, 4, 0, 0]} stackId="a" />
                  <Bar dataKey="pending" name="Pending" fill="#f59e0b" radius={[0, 0, 0, 0]} stackId="a" />
                  <Bar dataKey="failed" name="Failed" fill="#ef4444" radius={[0, 0, 4, 4]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── LEADS TAB ── */}
      {activeTab === 'leads' && (
        <div className="space-y-6">
          {/* Lead funnel */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h3 className="font-serif text-lg text-foreground mb-1">Lead Conversion Funnel</h3>
            <p className="text-xs text-muted-foreground mb-5">From inquiry to active client — last {range} days</p>
            {totalLeads === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">No leads in this period.</div>
            ) : (
              <div className="space-y-3">
                {leadFunnelData.map((stage, i) => {
                  const width = totalLeads > 0 ? pct(stage.count, totalLeads) : 0;
                  const colors = ['bg-blue-500', 'bg-violet-500', 'bg-amber-500', 'bg-emerald-500'];
                  return (
                    <div key={stage.stage} className="flex items-center gap-4">
                      <div className="w-28 flex-shrink-0 text-xs font-medium text-muted-foreground text-right">{stage.stage}</div>
                      <div className="flex-1 h-8 bg-secondary/30 rounded-xl overflow-hidden">
                        <div
                          className={`h-full ${colors[i]} rounded-xl transition-all duration-700 flex items-center justify-end pr-3`}
                          style={{ width: `${Math.max(width, stage.count > 0 ? 8 : 0)}%` }}
                        >
                          {stage.count > 0 && <span className="text-white text-xs font-bold">{stage.count}</span>}
                        </div>
                      </div>
                      <div className="w-10 flex-shrink-0 text-xs font-semibold text-foreground text-right">{width}%</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Practice area breakdown */}
          {practiceAreaData.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-card border border-border rounded-2xl p-6">
                <h3 className="font-serif text-lg text-foreground mb-1">Leads by Practice Area</h3>
                <p className="text-xs text-muted-foreground mb-5">Top areas driving inquiries</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={practiceAreaData} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} width={100} />
                    <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }} />
                    <Bar dataKey="value" name="Leads" fill={GOLD} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-card border border-border rounded-2xl p-6">
                <h3 className="font-serif text-lg text-foreground mb-1">Practice Area Mix</h3>
                <p className="text-xs text-muted-foreground mb-5">Proportional breakdown</p>
                <div className="flex items-center gap-6">
                  <ResponsiveContainer width="50%" height={180}>
                    <PieChart>
                      <Pie data={practiceAreaData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">
                        {practiceAreaData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col gap-2 flex-1 min-w-0">
                    {practiceAreaData.map((item, index) => (
                      <div key={item.name} className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[index % PIE_COLORS.length] }} />
                        <span className="text-xs text-muted-foreground truncate">{item.name}</span>
                        <span className="text-xs font-semibold text-foreground ml-auto flex-shrink-0">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Lead stage summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Leads', value: totalLeads, color: 'text-foreground', bg: 'bg-secondary/30 border-border' },
              { label: 'Consultation Booked', value: consultationLeads, color: 'text-violet-600', bg: 'bg-violet-50 border-violet-200' },
              { label: 'Proposal Sent', value: proposalLeads, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
              { label: 'Active Clients', value: activeLeads, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
            ].map((item) => (
              <div key={item.label} className={`border rounded-2xl p-4 text-center ${item.bg}`}>
                <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── LEGISLATION TAB ── */}
      {activeTab === 'legislation' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Saved Bills', value: legislationStats?.totalSaved ?? 0, color: 'text-[#1B2A4A]', bg: 'bg-[#1B2A4A]/5 border-[#1B2A4A]/20', icon: '📌' },
              { label: 'High Priority', value: legislationStats?.highPriority ?? 0, color: 'text-red-600', bg: 'bg-red-50 border-red-200', icon: '🔴' },
              { label: 'AI Summaries', value: legislationStats?.withSummaries ?? 0, color: 'text-[#B76E79]', bg: 'bg-[#B76E79]/5 border-[#B76E79]/20', icon: '🤖' },
              { label: 'Research Sessions', value: legislationStats?.researchSessions ?? 0, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', icon: '🔍' },
            ].map((item) => (
              <div key={item.label} className={`border rounded-2xl p-5 ${item.bg}`}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">{item.label}</p>
                  <span className="text-xl">{item.icon}</span>
                </div>
                <p className={`text-3xl font-bold ${item.color}`}>{item.value}</p>
              </div>
            ))}
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* By Practice Area */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <h3 className="font-serif text-lg text-foreground mb-1">Bills by Practice Area</h3>
              <p className="text-xs text-muted-foreground mb-5">Saved legislation tagged by practice area</p>
              {!legislationStats?.byPracticeArea?.length ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  No bills saved yet. <a href="/legislation" className="text-[#B76E79] hover:underline">Research legislation →</a>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={legislationStats.byPracticeArea} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} width={110} />
                    <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }} />
                    <Bar dataKey="value" name="Bills" fill="#1B2A4A" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* By Urgency */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <h3 className="font-serif text-lg text-foreground mb-1">Bills by Urgency</h3>
              <p className="text-xs text-muted-foreground mb-5">Priority distribution of saved legislation</p>
              {!legislationStats?.byUrgency?.length ? (
                <div className="py-10 text-center text-sm text-muted-foreground">No urgency data yet.</div>
              ) : (
                <div className="space-y-4">
                  {legislationStats.byUrgency.map((item) => {
                    const total = legislationStats.byUrgency.reduce((s, i) => s + i.value, 0);
                    const pctVal = total > 0 ? Math.round((item.value / total) * 100) : 0;
                    const color = item.name === 'high' ? 'bg-red-500' : item.name === 'medium' ? 'bg-amber-500' : 'bg-emerald-500';
                    const textColor = item.name === 'high' ? 'text-red-600' : item.name === 'medium' ? 'text-amber-600' : 'text-emerald-600';
                    return (
                      <div key={item.name} className="flex items-center gap-3">
                        <span className={`text-xs font-semibold capitalize w-16 ${textColor}`}>{item.name}</span>
                        <div className="flex-1 h-6 bg-secondary/30 rounded-xl overflow-hidden">
                          <div className={`h-full ${color} rounded-xl flex items-center justify-end pr-2`} style={{ width: `${Math.max(pctVal, 8)}%` }}>
                            <span className="text-white text-xs font-bold">{item.value}</span>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground w-8 text-right">{pctVal}%</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Recent Saved Bills */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-serif text-lg text-foreground">Recently Saved Bills</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Latest legislation saved from research</p>
              </div>
              <a
                href="/legislation"
                className="text-xs font-semibold text-[#B76E79] hover:text-[#B76E79]/80 transition-colors"
              >
                Open Research Hub →
              </a>
            </div>
            {!legislationStats?.recentSaved?.length ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No bills saved yet. <a href="/legislation" className="text-[#B76E79] hover:underline">Start researching →</a>
              </div>
            ) : (
              <div className="space-y-3">
                {legislationStats.recentSaved.map((bill, i) => (
                  <div key={i} className="flex items-start justify-between gap-4 py-3 border-b border-border last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{bill.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(bill.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {bill.relevance_score && (
                        <span className="px-2 py-0.5 bg-[#B76E79]/10 text-[#B76E79] rounded-full text-xs font-semibold">
                          {bill.relevance_score}/10
                        </span>
                      )}
                      {bill.urgency && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          bill.urgency === 'high' ? 'bg-red-100 text-red-700' :
                          bill.urgency === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {bill.urgency}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Open Legislation Hub', desc: 'Search and research bills', href: '/legislation', icon: '🏛️', color: 'bg-[#1B2A4A] text-white' },
              { label: 'View Saved Bills', desc: 'Review tagged legislation', href: '/legislation', icon: '📌', color: 'bg-white border border-border text-foreground' },
              { label: 'Research History', desc: 'Past Lexi research sessions', href: '/legislation', icon: '📋', color: 'bg-white border border-border text-foreground' },
            ].map((action) => (
              <a
                key={action.label}
                href={action.href}
                className={`rounded-2xl p-5 flex items-start gap-3 hover:shadow-md transition-all ${action.color}`}
              >
                <span className="text-2xl">{action.icon}</span>
                <div>
                  <p className="font-semibold text-sm">{action.label}</p>
                  <p className={`text-xs mt-0.5 ${action.color.includes('text-white') ? 'text-white/70' : 'text-muted-foreground'}`}>{action.desc}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
