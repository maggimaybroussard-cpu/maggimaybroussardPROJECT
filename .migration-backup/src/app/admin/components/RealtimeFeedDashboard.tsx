'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';

// ── Types ─────────────────────────────────────────────────────────────────────

type FeedEventType =
  | 'incoming_case' |'appointment_confirmed' |'appointment_cancelled' |'appointment_rescheduled' |'email_sent' |'hours_logged' |'payment_received' |'payment_pending' |'payment_failed' |'invoice_issued' |'case_update' |'new_lead';

interface FeedEvent {
  id: string;
  type: FeedEventType;
  title: string;
  subtitle: string;
  timestamp: string;
  amount?: number;
  meta?: Record<string, unknown>;
  isNew?: boolean;
}

interface LiveStats {
  casesToday: number;
  appointmentsToday: number;
  emailsSentToday: number;
  hoursLoggedToday: number;
  paymentsToday: number;
  revenueToday: number;
}

// ── Config ────────────────────────────────────────────────────────────────────

const EVENT_CONFIG: Record<FeedEventType, { label: string; color: string; bg: string; dot: string; icon: React.ReactNode }> = {
  incoming_case: {
    label: 'New Case',
    color: '#355E3B',
    bg: 'rgba(53,94,59,0.10)',
    dot: '#355E3B',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
      </svg>
    ),
  },
  appointment_confirmed: {
    label: 'Appt Confirmed',
    color: '#2563EB',
    bg: 'rgba(37,99,235,0.10)',
    dot: '#2563EB',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
        <polyline points="9 16 11 18 15 14"/>
      </svg>
    ),
  },
  appointment_cancelled: {
    label: 'Appt Cancelled',
    color: '#DC2626',
    bg: 'rgba(220,38,38,0.10)',
    dot: '#DC2626',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
        <line x1="10" y1="14" x2="14" y2="18"/>
        <line x1="14" y1="14" x2="10" y2="18"/>
      </svg>
    ),
  },
  appointment_rescheduled: {
    label: 'Appt Rescheduled',
    color: '#D97706',
    bg: 'rgba(217,119,6,0.10)',
    dot: '#D97706',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 4v6h-6"/>
        <path d="M1 20v-6h6"/>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
      </svg>
    ),
  },
  email_sent: {
    label: 'Email Sent',
    color: '#7C3AED',
    bg: 'rgba(124,58,237,0.10)',
    dot: '#7C3AED',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
        <polyline points="22,6 12,13 2,6"/>
      </svg>
    ),
  },
  hours_logged: {
    label: 'Hours Logged',
    color: '#0891B2',
    bg: 'rgba(8,145,178,0.10)',
    dot: '#0891B2',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
  },
  payment_received: {
    label: 'Payment Received',
    color: '#059669',
    bg: 'rgba(5,150,105,0.10)',
    dot: '#059669',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23"/>
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    ),
  },
  payment_pending: {
    label: 'Payment Pending',
    color: '#D97706',
    bg: 'rgba(217,119,6,0.10)',
    dot: '#D97706',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    ),
  },
  payment_failed: {
    label: 'Payment Failed',
    color: '#DC2626',
    bg: 'rgba(220,38,38,0.10)',
    dot: '#DC2626',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="15" y1="9" x2="9" y2="15"/>
        <line x1="9" y1="9" x2="15" y2="15"/>
      </svg>
    ),
  },
  invoice_issued: {
    label: 'Invoice Issued',
    color: '#6366F1',
    bg: 'rgba(99,102,241,0.10)',
    dot: '#6366F1',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
  },
  case_update: {
    label: 'Case Update',
    color: '#355E3B',
    bg: 'rgba(53,94,59,0.08)',
    dot: '#355E3B',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
  },
  new_lead: {
    label: 'New Lead',
    color: '#EC4899',
    bg: 'rgba(236,72,153,0.10)',
    dot: '#EC4899',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
};

const FILTER_GROUPS: { label: string; types: FeedEventType[] | 'all' }[] = [
  { label: 'All', types: 'all' },
  { label: 'Cases', types: ['incoming_case', 'case_update', 'new_lead'] },
  { label: 'Appointments', types: ['appointment_confirmed', 'appointment_cancelled', 'appointment_rescheduled'] },
  { label: 'Emails', types: ['email_sent'] },
  { label: 'Hours', types: ['hours_logged'] },
  { label: 'Payments', types: ['payment_received', 'payment_pending', 'payment_failed', 'invoice_issued'] },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const now = new Date();
  const then = new Date(dateStr);
  const diffMs = now.getTime() - then.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  if (diffSecs < 60) return `${diffSecs}s ago`;
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100);
}

function mapNotificationToFeedEvent(n: Record<string, unknown>): FeedEvent | null {
  let type = n.notification_type as string;
  const meta = (n.metadata as Record<string, unknown>) ?? {};

  const typeMap: Record<string, FeedEventType> = {
    case_update: 'case_update',
    invoice: 'invoice_issued',
    payment: 'payment_received',
    message: 'email_sent',
    task: 'hours_logged',
    system: 'case_update',
    approval_request: 'case_update',
    deadline_alert: 'case_update',
    document_change: 'case_update',
    consultation: 'appointment_confirmed',
  };

  const feedType: FeedEventType = typeMap[type] ?? 'case_update';

  return {
    id: n.id as string,
    type: feedType,
    title: n.title as string,
    subtitle: (n.body as string) ?? '',
    timestamp: n.created_at as string,
    amount: meta.amount_cents ? Number(meta.amount_cents) : undefined,
    meta,
    isNew: false,
  };
}

function mapInquiryToFeedEvent(row: Record<string, unknown>): FeedEvent {
  return {
    id: `lead-${row.id}`,
    type: 'new_lead',
    title: `New lead: ${row.name}`,
    subtitle: `${row.service ?? 'General inquiry'} — ${row.email}`,
    timestamp: row.created_at as string,
    isNew: false,
  };
}

function mapAppointmentToFeedEvent(row: Record<string, unknown>): FeedEvent {
  const status = row.status as string;
  let type: FeedEventType = 'appointment_confirmed';
  if (status === 'cancelled') type = 'appointment_cancelled';
  else if (status === 'rescheduled') type = 'appointment_rescheduled';

  return {
    id: `appt-${row.id}`,
    type,
    title: `${type === 'appointment_confirmed' ? 'Appointment confirmed' : type === 'appointment_cancelled' ? 'Appointment cancelled' : 'Appointment rescheduled'}: ${row.client_name ?? 'Client'}`,
    subtitle: `${row.appointment_type ?? 'Consultation'} — ${row.appointment_date ? new Date(row.appointment_date as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}`,
    timestamp: row.updated_at as string || row.created_at as string,
    isNew: false,
  };
}

function mapTimeLogToFeedEvent(row: Record<string, unknown>): FeedEvent {
  const hours = Number(row.hours_logged ?? 0);
  return {
    id: `hours-${row.id}`,
    type: 'hours_logged',
    title: `${hours.toFixed(1)}h logged`,
    subtitle: `${row.description ?? 'Billable work'} — ${row.case_name ?? row.matter_name ?? 'Case'}`,
    timestamp: row.created_at as string,
    isNew: false,
  };
}

function mapInvoiceToFeedEvent(row: Record<string, unknown>): FeedEvent {
  const status = row.payment_status as string ?? row.status as string;
  let type: FeedEventType = 'invoice_issued';
  if (status === 'paid') type = 'payment_received';
  else if (status === 'failed') type = 'payment_failed';
  else if (status === 'pending' || status === 'unpaid') type = 'payment_pending';

  const amount = Number(row.amount_cents ?? row.amount ?? 0);

  return {
    id: `inv-${row.id}`,
    type,
    title: type === 'payment_received' ? `Payment received` : type === 'payment_failed' ? `Payment failed` : type === 'payment_pending' ? `Payment pending` : `Invoice issued`,
    subtitle: `${row.client_name ?? row.name ?? 'Client'} — ${amount > 0 ? formatCurrency(amount > 1000 ? amount : amount * 100) : ''}`,
    timestamp: row.updated_at as string || row.created_at as string,
    amount: amount > 1000 ? amount : amount * 100,
    isNew: false,
  };
}

// ── Export Helper ─────────────────────────────────────────────────────────────

function exportDailySummaryCSV(stats: LiveStats, events: FeedEvent[]): void {
  const today = new Date();
  const dateLabel = today.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayEvents = events.filter(
    (e) => new Date(e.timestamp).getTime() >= todayStart.getTime()
  );

  const rows: string[][] = [];

  // Section 1: Daily Stats
  rows.push(['DAILY SUMMARY', dateLabel]);
  rows.push([]);
  rows.push(['STATS']);
  rows.push(['Metric', 'Value']);
  rows.push(['Cases Today', String(stats.casesToday)]);
  rows.push(['Appointments Today', String(stats.appointmentsToday)]);
  rows.push(['Emails Sent Today', String(stats.emailsSentToday)]);
  rows.push(['Hours Logged Today', stats.hoursLoggedToday.toFixed(1)]);
  rows.push(['Payments Today', String(stats.paymentsToday)]);
  rows.push(['Revenue Today', formatCurrency(stats.revenueToday)]);
  rows.push([]);

  // Section 2: Today's Events
  rows.push(['EVENTS TODAY', `(${todayEvents.length} total)`]);
  rows.push(['Time', 'Type', 'Title', 'Details', 'Amount']);
  todayEvents.forEach((e) => {
    const cfg = EVENT_CONFIG[e.type];
    const time = new Date(e.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const amount = e.amount && e.amount > 0 ? formatCurrency(e.amount) : '';
    rows.push([time, cfg.label, e.title, e.subtitle, amount]);
  });

  // Build CSV string
  const csv = rows
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    )
    .join('\n');

  // Trigger download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `live-feed-summary-${dateLabel}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  icon: React.ReactNode;
  pulse?: boolean;
}

function StatCard({ label, value, sub, color, icon, pulse }: StatCardProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
      <div className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${color}18`, color }}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xl font-semibold text-foreground tabular-nums">{value}</span>
          {pulse && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: color }} />
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: color }} />
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{label}</p>
        {sub && <p className="text-xs font-medium mt-0.5" style={{ color }}>{sub}</p>}
      </div>
    </div>
  );
}

// ── Feed Item ─────────────────────────────────────────────────────────────────

interface FeedItemProps {
  event: FeedEvent;
  isFirst: boolean;
}

function FeedItem({ event, isFirst }: FeedItemProps) {
  const cfg = EVENT_CONFIG[event.type];
  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 transition-all duration-300 ${
        event.isNew ? 'bg-primary/5 border-l-2 border-primary' : 'border-l-2 border-transparent'
      } ${isFirst ? '' : 'border-t border-border/50'}`}
    >
      {/* Icon */}
      <div
        className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5"
        style={{ background: cfg.bg, color: cfg.color }}
      >
        {cfg.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground leading-snug truncate">{event.title}</p>
            {event.subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{event.subtitle}</p>
            )}
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1">
            <span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo(event.timestamp)}</span>
            {event.amount !== undefined && event.amount > 0 && (
              <span className="text-xs font-semibold" style={{ color: cfg.color }}>
                {formatCurrency(event.amount)}
              </span>
            )}
          </div>
        </div>
        <div className="mt-1.5">
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider"
            style={{ background: cfg.bg, color: cfg.color }}
          >
            {cfg.label}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function RealtimeFeedDashboard() {
  const supabase = createClient();
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [stats, setStats] = useState<LiveStats>({
    casesToday: 0,
    appointmentsToday: 0,
    emailsSentToday: 0,
    hoursLoggedToday: 0,
    paymentsToday: 0,
    revenueToday: 0,
  });
  const [activeFilter, setActiveFilter] = useState<string>('All');
  const [loading, setLoading] = useState(true);
  const [liveCount, setLiveCount] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const newEventQueue = useRef<FeedEvent[]>([]);
  const feedRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // ── Export handler ─────────────────────────────────────────────────────────

  const handleExport = useCallback(() => {
    setIsExporting(true);
    try {
      exportDailySummaryCSV(stats, events);
    } finally {
      setTimeout(() => setIsExporting(false), 800);
    }
  }, [stats, events]);

  // ── Audio helpers ──────────────────────────────────────────────────────────

  const getAudioContext = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    return audioCtxRef.current;
  }, []);

  const playTone = useCallback((type: FeedEventType) => {
    if (!soundEnabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    // Resume context if suspended (browser autoplay policy)
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    // Frequency + envelope per event category
    const toneMap: Record<FeedEventType, { freq: number; freq2?: number; duration: number; type: OscillatorType }> = {
      incoming_case:           { freq: 880, freq2: 1100, duration: 0.35, type: 'sine' },
      new_lead:                { freq: 880, freq2: 1100, duration: 0.35, type: 'sine' },
      appointment_confirmed:   { freq: 660, freq2: 880,  duration: 0.3,  type: 'sine' },
      appointment_rescheduled: { freq: 550, freq2: 660,  duration: 0.25, type: 'sine' },
      appointment_cancelled:   { freq: 330, freq2: 220,  duration: 0.3,  type: 'sine' },
      email_sent:              { freq: 740, duration: 0.18, type: 'sine' },
      hours_logged:            { freq: 520, duration: 0.18, type: 'sine' },
      payment_received:        { freq: 523, freq2: 784,  duration: 0.4,  type: 'sine' },
      payment_pending:         { freq: 440, duration: 0.2,  type: 'sine' },
      payment_failed:          { freq: 220, freq2: 180,  duration: 0.35, type: 'sawtooth' },
      invoice_issued:          { freq: 600, freq2: 750,  duration: 0.28, type: 'sine' },
      case_update:             { freq: 480, duration: 0.18, type: 'sine' },
    };

    const cfg = toneMap[type] ?? { freq: 600, duration: 0.2, type: 'sine' as OscillatorType };

    try {
      const now = ctx.currentTime;
      const gainNode = ctx.createGain();
      gainNode.connect(ctx.destination);
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.18, now + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + cfg.duration);

      const osc = ctx.createOscillator();
      osc.type = cfg.type;
      osc.connect(gainNode);

      if (cfg.freq2) {
        // Two-note chime
        osc.frequency.setValueAtTime(cfg.freq, now);
        osc.frequency.setValueAtTime(cfg.freq2, now + cfg.duration * 0.45);
      } else {
        osc.frequency.setValueAtTime(cfg.freq, now);
      }

      osc.start(now);
      osc.stop(now + cfg.duration + 0.05);
    } catch {
      // silently ignore audio errors
    }
  }, [soundEnabled, getAudioContext]);

  // ── Load initial data ──────────────────────────────────────────────────────

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayISO = todayStart.toISOString();

    try {
      const [notifRes, inquiryRes, apptRes, timeRes, invoiceRes] = await Promise.all([
        supabase
          .from('notifications')
          .select('*')
          .eq('audience', 'admin')
          .order('created_at', { ascending: false })
          .limit(40),
        supabase
          .from('contact_inquiries')
          .select('id, name, email, service, created_at')
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('lexi_appointments')
          .select('id, client_name, appointment_type, appointment_date, status, created_at, updated_at')
          .order('updated_at', { ascending: false })
          .limit(20),
        supabase
          .from('retainer_time_logs')
          .select('id, hours_logged, description, created_at')
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('client_invoices')
          .select('id, amount_cents, payment_status, created_at, updated_at')
          .order('updated_at', { ascending: false })
          .limit(20),
      ]);

      const allEvents: FeedEvent[] = [];

      // Notifications
      if (notifRes.data) {
        notifRes.data.forEach((n) => {
          const ev = mapNotificationToFeedEvent(n as Record<string, unknown>);
          if (ev) allEvents.push(ev);
        });
      }

      // Leads
      if (inquiryRes.data) {
        inquiryRes.data.forEach((r) => allEvents.push(mapInquiryToFeedEvent(r as Record<string, unknown>)));
      }

      // Appointments
      if (apptRes.data) {
        apptRes.data.forEach((r) => allEvents.push(mapAppointmentToFeedEvent(r as Record<string, unknown>)));
      }

      // Time logs
      if (timeRes.data) {
        timeRes.data.forEach((r) => allEvents.push(mapTimeLogToFeedEvent(r as Record<string, unknown>)));
      }

      // Invoices
      if (invoiceRes.data) {
        invoiceRes.data.forEach((r) => allEvents.push(mapInvoiceToFeedEvent(r as Record<string, unknown>)));
      }

      // Sort by timestamp desc, deduplicate by id
      const seen = new Set<string>();
      const sorted = allEvents
        .filter((e) => { if (seen.has(e.id)) return false; seen.add(e.id); return true; })
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 80);

      setEvents(sorted);

      // Compute today stats
      const todayTs = todayStart.getTime();
      const casesToday = (inquiryRes.data ?? []).filter((r) => new Date(r.created_at).getTime() >= todayTs).length;
      const appointmentsToday = (apptRes.data ?? []).filter((r) => new Date(r.created_at).getTime() >= todayTs).length;
      const hoursLoggedToday = (timeRes.data ?? [])
        .filter((r) => new Date(r.created_at).getTime() >= todayTs)
        .reduce((sum, r) => sum + Number(r.hours_logged ?? 0), 0);
      const paidToday = (invoiceRes.data ?? []).filter(
        (r) => r.payment_status === 'paid' && new Date(r.updated_at).getTime() >= todayTs
      );
      const revenueToday = paidToday.reduce((sum, r) => sum + Number(r.amount_cents ?? 0), 0);
      const notifEmailsToday = (notifRes.data ?? []).filter(
        (n) => n.notification_type === 'message' && new Date(n.created_at).getTime() >= todayTs
      ).length;

      setStats({
        casesToday,
        appointmentsToday,
        emailsSentToday: notifEmailsToday,
        hoursLoggedToday,
        paymentsToday: paidToday.length,
        revenueToday,
      });
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  // ── Real-time subscriptions ────────────────────────────────────────────────

  const addLiveEvent = useCallback((event: FeedEvent) => {
    const liveEvent = { ...event, isNew: true };
    playTone(event.type);
    if (isPaused) {
      newEventQueue.current.push(liveEvent);
      setLiveCount((c) => c + 1);
      return;
    }
    setEvents((prev) => {
      const seen = new Set(prev.map((e) => e.id));
      if (seen.has(liveEvent.id)) return prev;
      return [liveEvent, ...prev].slice(0, 100);
    });
    // Auto-clear "new" highlight after 4s
    setTimeout(() => {
      setEvents((prev) => prev.map((e) => e.id === liveEvent.id ? { ...e, isNew: false } : e));
    }, 4000);
  }, [isPaused, playTone]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    // Subscribe to notifications table
    const notifChannel = supabase
      .channel('realtime-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        const ev = mapNotificationToFeedEvent(payload.new as Record<string, unknown>);
        if (ev) addLiveEvent(ev);
      })
      .subscribe();

    // Subscribe to contact_inquiries (new leads / cases)
    const inquiryChannel = supabase
      .channel('realtime-inquiries')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'contact_inquiries' }, (payload) => {
        addLiveEvent(mapInquiryToFeedEvent(payload.new as Record<string, unknown>));
        setStats((s) => ({ ...s, casesToday: s.casesToday + 1 }));
      })
      .subscribe();

    // Subscribe to lexi_appointments
    const apptChannel = supabase
      .channel('realtime-appointments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lexi_appointments' }, (payload) => {
        const row = (payload.new ?? payload.old) as Record<string, unknown>;
        if (row) {
          addLiveEvent(mapAppointmentToFeedEvent(row));
          if (payload.eventType === 'INSERT') {
            setStats((s) => ({ ...s, appointmentsToday: s.appointmentsToday + 1 }));
          }
        }
      })
      .subscribe();

    // Subscribe to retainer_time_logs
    const timeChannel = supabase
      .channel('realtime-timelogs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'retainer_time_logs' }, (payload) => {
        addLiveEvent(mapTimeLogToFeedEvent(payload.new as Record<string, unknown>));
        const hrs = Number((payload.new as Record<string, unknown>).hours_logged ?? 0);
        setStats((s) => ({ ...s, hoursLoggedToday: s.hoursLoggedToday + hrs }));
      })
      .subscribe();

    // Subscribe to client_invoices
    const invoiceChannel = supabase
      .channel('realtime-invoices')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_invoices' }, (payload) => {
        const row = (payload.new ?? payload.old) as Record<string, unknown>;
        if (row) {
          addLiveEvent(mapInvoiceToFeedEvent(row));
          if ((row.payment_status as string) === 'paid') {
            setStats((s) => ({
              ...s,
              paymentsToday: s.paymentsToday + 1,
              revenueToday: s.revenueToday + Number(row.amount_cents ?? 0),
            }));
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(notifChannel);
      supabase.removeChannel(inquiryChannel);
      supabase.removeChannel(apptChannel);
      supabase.removeChannel(timeChannel);
      supabase.removeChannel(invoiceChannel);
    };
  }, [supabase, addLiveEvent]);

  // ── Resume from pause ──────────────────────────────────────────────────────

  const handleResume = useCallback(() => {
    setIsPaused(false);
    const queued = newEventQueue.current;
    newEventQueue.current = [];
    setLiveCount(0);
    if (queued.length > 0) {
      setEvents((prev) => {
        const seen = new Set(prev.map((e) => e.id));
        const fresh = queued.filter((e) => !seen.has(e.id));
        return [...fresh, ...prev].slice(0, 100);
      });
      setTimeout(() => {
        setEvents((prev) => prev.map((e) => ({ ...e, isNew: false })));
      }, 4000);
    }
    feedRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // ── Filter events ──────────────────────────────────────────────────────────

  const filteredEvents = React.useMemo(() => {
    const group = FILTER_GROUPS.find((g) => g.label === activeFilter);
    if (!group || group.types === 'all') return events;
    return events.filter((e) => (group.types as FeedEventType[]).includes(e.type));
  }, [events, activeFilter]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
          </span>
          <span className="text-sm font-medium text-foreground">Live Feed</span>
          <span className="text-xs text-muted-foreground">· Real-time updates</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Export button */}
          <button
            onClick={handleExport}
            disabled={isExporting || loading}
            title="Export today's summary as CSV"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-secondary/40 text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? (
              <>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Exporting…
              </>
            ) : (
              <>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Export CSV
              </>
            )}
          </button>
          {/* Sound toggle */}
          <button
            onClick={() => setSoundEnabled((s) => !s)}
            title={soundEnabled ? 'Mute sound alerts' : 'Enable sound alerts'}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              soundEnabled
                ? 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/15' :'bg-secondary/40 border-border text-muted-foreground hover:text-foreground hover:bg-secondary/60'
            }`}
          >
            {soundEnabled ? (
              <>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                </svg>
                Sound On
              </>
            ) : (
              <>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                  <line x1="23" y1="9" x2="17" y2="15"/>
                  <line x1="17" y1="9" x2="23" y2="15"/>
                </svg>
                Sound Off
              </>
            )}
          </button>
          <button
            onClick={() => setIsPaused((p) => !p)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              isPaused
                ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100' :'bg-secondary/40 border-border text-muted-foreground hover:text-foreground hover:bg-secondary/60'
            }`}
          >
            {isPaused ? (
              <>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Resume
              </>
            ) : (
              <>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                Pause
              </>
            )}
          </button>
          <button
            onClick={loadInitialData}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-secondary/40 text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          label="Cases Today"
          value={stats.casesToday}
          color="#355E3B"
          pulse={stats.casesToday > 0}
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>}
        />
        <StatCard
          label="Appointments"
          value={stats.appointmentsToday}
          color="#2563EB"
          pulse={stats.appointmentsToday > 0}
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
        />
        <StatCard
          label="Emails Sent"
          value={stats.emailsSentToday}
          color="#7C3AED"
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>}
        />
        <StatCard
          label="Hours Logged"
          value={stats.hoursLoggedToday.toFixed(1)}
          color="#0891B2"
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
        />
        <StatCard
          label="Payments"
          value={stats.paymentsToday}
          color="#059669"
          pulse={stats.paymentsToday > 0}
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
        />
        <StatCard
          label="Revenue Today"
          value={formatCurrency(stats.revenueToday)}
          color="#059669"
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>}
        />
      </div>

      {/* Feed Panel */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1 px-4 py-3 border-b border-border overflow-x-auto scrollbar-hide">
          {FILTER_GROUPS.map((g) => (
            <button
              key={g.label}
              onClick={() => setActiveFilter(g.label)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeFilter === g.label
                  ? 'bg-primary/10 text-primary' :'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
              }`}
            >
              {g.label}
            </button>
          ))}
          <div className="ml-auto shrink-0 text-xs text-muted-foreground">
            {filteredEvents.length} events
          </div>
        </div>

        {/* New events banner */}
        {isPaused && liveCount > 0 && (
          <button
            onClick={handleResume}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/15 transition-colors border-b border-primary/20"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            {liveCount} new event{liveCount !== 1 ? 's' : ''} — click to resume
          </button>
        )}

        {/* Feed list */}
        <div ref={feedRef} className="overflow-y-auto" style={{ maxHeight: '560px' }}>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Loading activity feed…</p>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-12 h-12 rounded-full bg-secondary/40 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">No activity yet</p>
                <p className="text-xs text-muted-foreground mt-1">Events will appear here in real-time</p>
              </div>
            </div>
          ) : (
            <div>
              {filteredEvents.map((event, idx) => (
                <FeedItem key={event.id} event={event} isFirst={idx === 0} />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && filteredEvents.length > 0 && (
          <div className="px-4 py-2.5 border-t border-border bg-secondary/10 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Showing {filteredEvents.length} recent events</span>
            <button
              onClick={loadInitialData}
              className="text-xs text-primary hover:underline font-medium"
            >
              Load more
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
