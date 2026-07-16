'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import AppLogo from '@/components/ui/AppLogo';
import NotificationCenter from '@/components/NotificationCenter';
import PushNotificationManager from '@/components/PushNotificationManager';

// ── Types ─────────────────────────────────────────────────────────────────────
type Frequency = 'immediate' | 'daily_digest' | 'weekly_digest' | 'off';

interface NotificationChannel {
  email: boolean;
  sms: boolean;
  in_app: boolean;
}

interface NotificationRule {
  id: string;
  label: string;
  description: string;
  category: 'billing' | 'case' | 'tasks' | 'reminders';
  enabled: boolean;
  frequency: Frequency;
  channels: NotificationChannel;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const CATEGORY_META: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  billing: {
    label: 'Billing & Invoices',
    color: '#C8965A',
    bg: 'rgba(200,150,90,0.08)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    ),
  },
  case: {
    label: 'Case Updates',
    color: '#355E3B',
    bg: 'rgba(53,94,59,0.08)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
      </svg>
    ),
  },
  tasks: {
    label: 'Task Assignments',
    color: '#6366f1',
    bg: 'rgba(99,102,241,0.08)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
  reminders: {
    label: 'Reminders',
    color: '#0891b2',
    bg: 'rgba(8,145,178,0.08)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
};

const FREQUENCY_OPTIONS: { value: Frequency; label: string; desc: string }[] = [
  { value: 'immediate', label: 'Immediate', desc: 'As it happens' },
  { value: 'daily_digest', label: 'Daily Digest', desc: 'Once per day' },
  { value: 'weekly_digest', label: 'Weekly', desc: 'Once per week' },
  { value: 'off', label: 'Off', desc: 'No notifications' },
];

const DEFAULT_RULES: NotificationRule[] = [
  {
    id: 'invoice_issued',
    label: 'Invoice Issued',
    description: 'When a new invoice is created and sent to you.',
    category: 'billing',
    enabled: true,
    frequency: 'immediate',
    channels: { email: true, sms: false, in_app: true },
  },
  {
    id: 'invoice_reminder',
    label: 'Invoice Payment Reminder',
    description: 'Reminder before your invoice due date.',
    category: 'billing',
    enabled: true,
    frequency: 'daily_digest',
    channels: { email: true, sms: false, in_app: true },
  },
  {
    id: 'invoice_overdue',
    label: 'Invoice Overdue',
    description: 'Alert when an invoice becomes past due.',
    category: 'billing',
    enabled: true,
    frequency: 'immediate',
    channels: { email: true, sms: true, in_app: true },
  },
  {
    id: 'payment_received',
    label: 'Payment Confirmed',
    description: 'Confirmation when your payment is processed.',
    category: 'billing',
    enabled: true,
    frequency: 'immediate',
    channels: { email: true, sms: false, in_app: true },
  },
  {
    id: 'case_update',
    label: 'Case Status Change',
    description: 'When your case moves to a new stage.',
    category: 'case',
    enabled: true,
    frequency: 'immediate',
    channels: { email: true, sms: false, in_app: true },
  },
  {
    id: 'case_note',
    label: 'New Case Note',
    description: 'When a note or update is added to your case.',
    category: 'case',
    enabled: true,
    frequency: 'daily_digest',
    channels: { email: true, sms: false, in_app: true },
  },
  {
    id: 'document_uploaded',
    label: 'Document Uploaded',
    description: 'When a new document is added to your case.',
    category: 'case',
    enabled: true,
    frequency: 'immediate',
    channels: { email: true, sms: false, in_app: true },
  },
  {
    id: 'task_assigned',
    label: 'Task Assigned to You',
    description: 'When a deliverable or action item is assigned.',
    category: 'tasks',
    enabled: true,
    frequency: 'immediate',
    channels: { email: true, sms: false, in_app: true },
  },
  {
    id: 'task_due_soon',
    label: 'Task Due Soon',
    description: 'Reminder when a task deadline is approaching.',
    category: 'tasks',
    enabled: true,
    frequency: 'daily_digest',
    channels: { email: true, sms: false, in_app: true },
  },
  {
    id: 'appointment_reminder',
    label: 'Appointment Reminder',
    description: 'Reminder before a scheduled consultation.',
    category: 'reminders',
    enabled: true,
    frequency: 'immediate',
    channels: { email: true, sms: true, in_app: true },
  },
  {
    id: 'retainer_renewal',
    label: 'Retainer Renewal',
    description: 'When your retainer agreement is up for renewal.',
    category: 'reminders',
    enabled: true,
    frequency: 'weekly_digest',
    channels: { email: true, sms: false, in_app: true },
  },
  {
    id: 'marketing_emails',
    label: 'Firm Updates & News',
    description: 'Newsletters, legal tips, and firm announcements.',
    category: 'reminders',
    enabled: false,
    frequency: 'weekly_digest',
    channels: { email: true, sms: false, in_app: false },
  },
];

const PORTAL_NAV = [
  {
    href: '/portal/dashboard',
    label: 'Dashboard',
    icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>,
  },
  {
    href: '/portal/cases',
    label: 'My Cases',
    icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>,
  },
  {
    href: '/portal/invoices',
    label: 'Invoices',
    icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>,
  },
  {
    href: '/portal/messages',
    label: 'Messages',
    icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
  },
  {
    href: '/portal/notifications',
    label: 'Notifications',
    icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>,
  },
  {
    href: '/portal/settings',
    label: 'Settings',
    icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06-.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>,
  },
];

// ── Sub-components ────────────────────────────────────────────────────────────
function FrequencyPicker({
  value,
  onChange,
  disabled,
}: {
  value: Frequency;
  onChange: (v: Frequency) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex gap-1 flex-wrap">
      {FREQUENCY_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => !disabled && onChange(opt.value)}
          disabled={disabled}
          title={opt.desc}
          className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-widest transition-all duration-150 border ${
            value === opt.value
              ? 'border-primary/40 text-primary bg-primary/8' :'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground'
          } disabled:opacity-40 disabled:cursor-not-allowed`}
          style={value === opt.value ? { background: 'rgba(53,94,59,0.08)', color: '#355E3B', borderColor: 'rgba(53,94,59,0.35)' } : {}}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function ChannelToggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-widest border transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${
        checked
          ? 'border-emerald-300 text-emerald-700 bg-emerald-50' :'border-border text-muted-foreground bg-transparent hover:border-foreground/30'
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${checked ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`}
      />
      {label}
    </button>
  );
}

function NotificationCard({
  rule,
  onToggle,
  onFrequencyChange,
  onChannelChange,
}: {
  rule: NotificationRule;
  onToggle: (id: string) => void;
  onFrequencyChange: (id: string, freq: Frequency) => void;
  onChannelChange: (id: string, channel: keyof NotificationChannel, val: boolean) => void;
}) {
  return (
    <div
      className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
        rule.enabled ? 'border-border bg-card' : 'border-border/40 bg-muted/20'
      }`}
    >
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className={`text-sm font-semibold ${rule.enabled ? 'text-foreground' : 'text-muted-foreground'}`}>
                {rule.label}
              </p>
              {!rule.enabled && (
                <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                  Muted
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground font-light">{rule.description}</p>
          </div>
          {/* Master toggle */}
          <button
            role="switch"
            aria-checked={rule.enabled}
            onClick={() => onToggle(rule.id)}
            className="relative flex-shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{
              background: rule.enabled ? '#355E3B' : '#d1d5db',
              height: '22px',
              width: '40px',
            }}
          >
            <span
              className="absolute top-0.5 left-0.5 w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform duration-200"
              style={{ transform: rule.enabled ? 'translateX(18px)' : 'translateX(0)' }}
            />
          </button>
        </div>

        {rule.enabled && (
          <div className="mt-4 space-y-3 pt-3 border-t border-border/40">
            {/* Frequency */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
                Frequency
              </p>
              <FrequencyPicker
                value={rule.frequency}
                onChange={(freq) => onFrequencyChange(rule.id, freq)}
                disabled={!rule.enabled}
              />
            </div>
            {/* Channels */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
                Channels
              </p>
              <div className="flex gap-1.5 flex-wrap">
                <ChannelToggle
                  label="Email"
                  checked={rule.channels.email}
                  onChange={(v) => onChannelChange(rule.id, 'email', v)}
                  disabled={!rule.enabled}
                />
                <ChannelToggle
                  label="SMS"
                  checked={rule.channels.sms}
                  onChange={(v) => onChannelChange(rule.id, 'sms', v)}
                  disabled={!rule.enabled}
                />
                <ChannelToggle
                  label="In-App"
                  checked={rule.channels.in_app}
                  onChange={(v) => onChannelChange(rule.id, 'in_app', v)}
                  disabled={!rule.enabled}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function NotificationsPage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();

  const [rules, setRules] = useState<NotificationRule[]>(DEFAULT_RULES);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [signingOut, setSigningOut] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [globalPause, setGlobalPause] = useState(false);

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !user) router.replace('/portal/login');
  }, [user, authLoading, router]);

  // ── Load preferences ────────────────────────────────────────────────────────
  const loadPreferences = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('client_notification_preferences')
        .select('*')
        .eq('user_id', user.id);

      if (data && data.length > 0) {
        // Merge saved preferences over defaults
        const savedMap: Record<string, typeof data[0]> = {};
        data.forEach((row) => { savedMap[row.notification_type] = row; });

        setRules((prev) =>
          prev.map((rule) => {
            const saved = savedMap[rule.id];
            if (!saved) return rule;
            return {
              ...rule,
              enabled: saved.enabled,
              frequency: saved.frequency as Frequency,
              channels: {
                email: saved.channel_email,
                sms: saved.channel_sms,
                in_app: saved.channel_in_app,
              },
            };
          })
        );

        // Check global pause from user_profiles
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('notification_prefs')
          .eq('id', user.id)
          .maybeSingle();

        if (profile?.notification_prefs?.global_pause) {
          setGlobalPause(true);
        }
      }
    } catch {
      // silently use defaults
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) loadPreferences();
  }, [user, loadPreferences]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleToggle = (id: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
  };

  const handleFrequencyChange = (id: string, freq: Frequency) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, frequency: freq } : r))
    );
  };

  const handleChannelChange = (id: string, channel: keyof NotificationChannel, val: boolean) => {
    setRules((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, channels: { ...r.channels, [channel]: val } } : r
      )
    );
  };

  const handleMuteAll = () => {
    setRules((prev) => prev.map((r) => ({ ...r, enabled: false })));
  };

  const handleRestoreDefaults = () => {
    setRules(DEFAULT_RULES);
    setGlobalPause(false);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaveStatus('saving');
    try {
      const supabase = createClient();

      // Upsert each rule
      const upserts = rules.map((rule) => ({
        user_id: user.id,
        notification_type: rule.id,
        category: rule.category,
        enabled: rule.enabled,
        frequency: rule.frequency,
        channel_email: rule.channels.email,
        channel_sms: rule.channels.sms,
        channel_in_app: rule.channels.in_app,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('client_notification_preferences')
        .upsert(upserts, { onConflict: 'user_id,notification_type' });

      if (error) throw error;

      // Also persist global_pause to user_profiles
      await supabase
        .from('user_profiles')
        .upsert(
          { id: user.id, notification_prefs: { global_pause: globalPause }, updated_at: new Date().toISOString() },
          { onConflict: 'id' }
        );

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2500);
    }
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

  // ── Derived ─────────────────────────────────────────────────────────────────
  const categories = ['all', 'billing', 'case', 'tasks', 'reminders'];
  const filteredRules =
    activeCategory === 'all' ? rules : rules.filter((r) => r.category === activeCategory);

  const enabledCount = rules.filter((r) => r.enabled).length;
  const totalCount = rules.length;

  // ── Loading skeleton ─────────────────────────────────────────────────────────
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/60">
          <div className="max-w-6xl mx-auto px-6 md:px-10 py-4 flex items-center justify-between">
            <div className="w-28 h-7 bg-muted/60 rounded-lg animate-pulse" />
            <div className="flex items-center gap-3">
              <div className="w-20 h-8 bg-muted/60 rounded-lg animate-pulse" />
            </div>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-6 md:px-10 py-10">
          <div className="w-64 h-8 bg-muted/60 rounded-lg animate-pulse mb-8" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-full h-20 bg-muted/40 rounded-2xl animate-pulse" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FAF7F2' }}>
      {/* ── Top bar ── */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/60">
        <div className="max-w-6xl mx-auto px-4 md:px-10">
          <div className="flex items-center justify-between py-3.5">
            <Link href="/" className="inline-flex items-center gap-3 group">
              <AppLogo size={30} className="transition-transform duration-300 group-hover:scale-105" />
              <span className="font-serif text-sm tracking-tight hidden sm:block" style={{ color: '#355E3B' }}>
                Maggi May Broussard
              </span>
            </Link>
            <div className="flex items-center gap-2 flex-wrap">
              {PORTAL_NAV.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full border text-xs font-semibold uppercase tracking-widest transition-all duration-200 ${
                    link.href === '/portal/notifications'
                      ? 'border-primary/40 text-primary bg-primary/5' :'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
                  }`}
                  style={
                    link.href === '/portal/notifications'
                      ? { borderColor: 'rgba(53,94,59,0.4)', color: '#355E3B', background: 'rgba(53,94,59,0.06)' }
                      : {}
                  }
                >
                  {link.icon}
                  <span className="hidden sm:inline">{link.label}</span>
                </Link>
              ))}
              <span className="text-xs text-muted-foreground hidden md:block truncate max-w-[160px]">
                {user?.email}
              </span>
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-border text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all duration-200 disabled:opacity-60"
              >
                {signingOut ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                )}
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 900, margin: '0 auto', padding: '32px 16px 64px' }}>
        {/* ── Page header ── */}
        <div className="mb-8">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">
            Client Portal
          </p>
          <h1 className="font-serif text-3xl md:text-4xl text-foreground">Notifications</h1>
          <p className="text-sm text-muted-foreground font-light mt-1">
            View your case updates, document changes, and alerts — then manage your notification preferences below.
          </p>
        </div>

        {/* Push Notification Banner */}
        <div className="mb-6">
          <PushNotificationManager
            userId={user?.id}
            userType="client"
          />
        </div>

        {/* ── Notification Center ── */}
        <div className="mb-12">
          <NotificationCenter audience="client" userId={user?.id} />
        </div>

        {/* ── Preferences divider ── */}
        <div className="flex items-center gap-4 mb-8">
          <div className="flex-1 h-px bg-border" />
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold flex-shrink-0">
            Notification Preferences
          </p>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* ── Summary bar ── */}
        <div
          className="rounded-2xl border border-border p-5 mb-6 flex flex-col sm:flex-row sm:items-center gap-4"
          style={{ background: 'linear-gradient(135deg, rgba(53,94,59,0.05) 0%, rgba(53,94,59,0.01) 100%)' }}
        >
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(53,94,59,0.12)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {enabledCount} of {totalCount} notification types active
                </p>
                <p className="text-xs text-muted-foreground font-light">
                  {globalPause ? 'All notifications are globally paused.' : 'Notifications are running normally.'}
                </p>
              </div>
            </div>
            {/* Progress bar */}
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(enabledCount / totalCount) * 100}%`,
                  background: globalPause ? '#d1d5db' : '#355E3B',
                }}
              />
            </div>
          </div>

          {/* Global pause toggle */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="text-right">
              <p className="text-xs font-semibold text-foreground">Global Pause</p>
              <p className="text-[10px] text-muted-foreground font-light">Silence everything temporarily</p>
            </div>
            <button
              role="switch"
              aria-checked={globalPause}
              onClick={() => setGlobalPause((v) => !v)}
              className="relative flex-shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{
                background: globalPause ? '#dc2626' : '#d1d5db',
                height: '22px',
                width: '40px',
              }}
            >
              <span
                className="absolute top-0.5 left-0.5 w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform duration-200"
                style={{ transform: globalPause ? 'translateX(18px)' : 'translateX(0)' }}
              />
            </button>
          </div>
        </div>

        {/* ── Category filter tabs ── */}
        <div className="flex gap-1 p-1 bg-muted/40 rounded-2xl mb-6 overflow-x-auto">
          {categories.map((cat) => {
            const meta = cat !== 'all' ? CATEGORY_META[cat] : null;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`flex-1 min-w-max inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all duration-200 ${
                  activeCategory === cat
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {meta && (
                  <span style={{ color: activeCategory === cat ? meta.color : undefined }}>
                    {meta.icon}
                  </span>
                )}
                {cat === 'all' ? 'All' : meta?.label}
              </button>
            );
          })}
        </div>

        {/* ── Category sections ── */}
        {activeCategory === 'all' ? (
          <div className="space-y-8">
            {(['billing', 'case', 'tasks', 'reminders'] as const).map((cat) => {
              const catRules = rules.filter((r) => r.category === cat);
              const meta = CATEGORY_META[cat];
              return (
                <section key={cat}>
                  <div className="flex items-center gap-2.5 mb-3">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: meta.bg, color: meta.color }}
                    >
                      {meta.icon}
                    </div>
                    <h2 className="text-sm font-semibold text-foreground">{meta.label}</h2>
                    <span className="text-xs text-muted-foreground font-light">
                      {catRules.filter((r) => r.enabled).length}/{catRules.length} active
                    </span>
                  </div>
                  <div className="space-y-2">
                    {catRules.map((rule) => (
                      <NotificationCard
                        key={rule.id}
                        rule={rule}
                        onToggle={handleToggle}
                        onFrequencyChange={handleFrequencyChange}
                        onChannelChange={handleChannelChange}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredRules.map((rule) => (
              <NotificationCard
                key={rule.id}
                rule={rule}
                onToggle={handleToggle}
                onFrequencyChange={handleFrequencyChange}
                onChannelChange={handleChannelChange}
              />
            ))}
          </div>
        )}

        {/* ── Action bar ── */}
        <div className="mt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-6 border-t border-border/60">
          <div className="flex items-center gap-2">
            <button
              onClick={handleMuteAll}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all duration-200"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="1" y1="1" x2="23" y2="23" /><path d="M17 17H3s3-2 3-9a4.67 4.67 0 0 1 .33-1.67M9.58 4.58A6 6 0 0 1 18 8c0 2.34-.37 4.14-.9 5.57M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              Mute All
            </button>
            <button
              onClick={handleRestoreDefaults}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all duration-200"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-3.5" />
              </svg>
              Restore Defaults
            </button>
          </div>

          <button
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-semibold uppercase tracking-widest transition-all duration-200 disabled:opacity-60"
            style={{
              background:
                saveStatus === 'saved' ?'#16a34a'
                  : saveStatus === 'error' ?'#dc2626' :'#355E3B',
              color: '#fff',
            }}
          >
            {saveStatus === 'saving' && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            )}
            {saveStatus === 'saved' && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
            {saveStatus === 'error' && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            )}
            {saveStatus === 'saving' ?'Saving…'
              : saveStatus === 'saved' ?'Preferences Saved!'
              : saveStatus === 'error' ?'Save Failed' :'Save Preferences'}
          </button>
        </div>
      </main>
    </div>
  );
}
