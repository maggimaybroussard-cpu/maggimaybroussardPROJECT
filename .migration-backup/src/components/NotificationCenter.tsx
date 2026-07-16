'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ── Types ─────────────────────────────────────────────────────────────────────

type NotificationAudience = 'admin' | 'client';
type NotificationType =
  | 'case_update' |'document_change' |'approval_request' |'deadline_alert' |'message' |'invoice' |'payment' |'task' |'system' |'consultation';

interface AppNotification {
  id: string;
  audience: NotificationAudience;
  user_id: string | null;
  inquiry_id: string | null;
  notification_type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  is_dismissed: boolean;
  is_archived: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

type FilterTab = 'all' | 'unread' | 'archived';

interface NotificationCenterProps {
  audience: NotificationAudience;
  userId?: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_META: Record<
  NotificationType,
  { label: string; color: string; bg: string; icon: React.ReactNode }
> = {
  case_update: {
    label: 'Case Update',
    color: '#355E3B',
    bg: 'rgba(53,94,59,0.10)',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  document_change: {
    label: 'Document',
    color: '#2563EB',
    bg: 'rgba(37,99,235,0.10)',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <path d="M12 18v-6" />
        <path d="M9 15l3-3 3 3" />
      </svg>
    ),
  },
  approval_request: {
    label: 'Approval',
    color: '#7C3AED',
    bg: 'rgba(124,58,237,0.10)',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  },
  deadline_alert: {
    label: 'Deadline',
    color: '#DC2626',
    bg: 'rgba(220,38,38,0.10)',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  message: {
    label: 'Message',
    color: '#0891B2',
    bg: 'rgba(8,145,178,0.10)',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  invoice: {
    label: 'Invoice',
    color: '#C8965A',
    bg: 'rgba(200,150,90,0.10)',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    ),
  },
  payment: {
    label: 'Payment',
    color: '#059669',
    bg: 'rgba(5,150,105,0.10)',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  task: {
    label: 'Task',
    color: '#6366F1',
    bg: 'rgba(99,102,241,0.10)',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 11 12 14 22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
  system: {
    label: 'System',
    color: '#6B7280',
    bg: 'rgba(107,114,128,0.10)',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
  consultation: {
    label: 'Consultation',
    color: '#355E3B',
    bg: 'rgba(53,94,59,0.10)',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
};

function timeAgo(dateStr: string): string {
  const now = new Date();
  const then = new Date(dateStr);
  const diff = Math.floor((now.getTime() - then.getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const TYPE_FILTER_OPTIONS: { value: NotificationType | 'all'; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'case_update', label: 'Case Updates' },
  { value: 'document_change', label: 'Documents' },
  { value: 'approval_request', label: 'Approvals' },
  { value: 'deadline_alert', label: 'Deadlines' },
  { value: 'message', label: 'Messages' },
  { value: 'invoice', label: 'Invoices' },
  { value: 'payment', label: 'Payments' },
  { value: 'task', label: 'Tasks' },
  { value: 'consultation', label: 'Consultations' },
];

// ── Main Component ────────────────────────────────────────────────────────────

export default function NotificationCenter({ audience, userId }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [typeFilter, setTypeFilter] = useState<NotificationType | 'all'>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      let query = supabase
        .from('notifications')
        .select('*')
        .eq('audience', audience)
        .order('created_at', { ascending: false })
        .limit(100);

      if (audience === 'client' && userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setNotifications((data as AppNotification[]) ?? []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [audience, userId]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Real-time subscription
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${audience}:${userId ?? 'admin'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: audience === 'client' && userId ? `user_id=eq.${userId}` : `audience=eq.${audience}`,
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [audience, userId, fetchNotifications]);

  const markRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    const supabase = createClient();
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  };

  const dismiss = async (id: string) => {
    setActionLoading(id + '_dismiss');
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_dismissed: true } : n))
    );
    const supabase = createClient();
    await supabase.from('notifications').update({ is_dismissed: true, is_read: true }).eq('id', id);
    setActionLoading(null);
  };

  const archive = async (id: string) => {
    setActionLoading(id + '_archive');
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_archived: true, is_read: true } : n))
    );
    const supabase = createClient();
    await supabase.from('notifications').update({ is_archived: true, is_read: true }).eq('id', id);
    setActionLoading(null);
  };

  const unarchive = async (id: string) => {
    setActionLoading(id + '_unarchive');
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_archived: false } : n))
    );
    const supabase = createClient();
    await supabase.from('notifications').update({ is_archived: false }).eq('id', id);
    setActionLoading(null);
  };

  const markAllRead = async () => {
    const unread = notifications.filter((n) => !n.is_read && !n.is_dismissed && !n.is_archived);
    if (!unread.length) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    const supabase = createClient();
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .in('id', unread.map((n) => n.id));
  };

  const dismissAll = async () => {
    const active = notifications.filter((n) => !n.is_dismissed && !n.is_archived);
    if (!active.length) return;
    setNotifications((prev) =>
      prev.map((n) =>
        !n.is_dismissed && !n.is_archived ? { ...n, is_dismissed: true, is_read: true } : n
      )
    );
    const supabase = createClient();
    await supabase
      .from('notifications')
      .update({ is_dismissed: true, is_read: true })
      .in('id', active.map((n) => n.id));
  };

  // Filter logic
  const visible = notifications.filter((n) => {
    if (n.is_dismissed) return false;
    if (activeTab === 'archived') return n.is_archived;
    if (n.is_archived) return false;
    if (activeTab === 'unread') return !n.is_read;
    return true;
  });

  const filtered = typeFilter === 'all'
    ? visible
    : visible.filter((n) => n.notification_type === typeFilter);

  const unreadCount = notifications.filter((n) => !n.is_read && !n.is_dismissed && !n.is_archived).length;
  const archivedCount = notifications.filter((n) => n.is_archived && !n.is_dismissed).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-serif text-2xl text-foreground mb-1">Notification Center</h2>
          <p className="text-sm text-muted-foreground font-light">
            Case updates, document changes, approval requests, and deadline alerts
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={markAllRead}
            disabled={unreadCount === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Mark all read
          </button>
          <button
            onClick={dismissAll}
            disabled={notifications.filter((n) => !n.is_dismissed && !n.is_archived).length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Dismiss all
          </button>
          <button
            onClick={fetchNotifications}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
              <path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-2xl p-4 text-center">
          <p className="text-2xl font-semibold text-foreground">{unreadCount}</p>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mt-0.5">Unread</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 text-center">
          <p className="text-2xl font-semibold text-foreground">
            {notifications.filter((n) => !n.is_dismissed && !n.is_archived).length}
          </p>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mt-0.5">Active</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 text-center">
          <p className="text-2xl font-semibold text-foreground">{archivedCount}</p>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mt-0.5">Archived</p>
        </div>
      </div>

      {/* Tabs + type filter */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-secondary/40 rounded-xl p-1 w-fit">
          {(
            [
              { id: 'all', label: 'Active' },
              { id: 'unread', label: `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}` },
              { id: 'archived', label: `Archived${archivedCount > 0 ? ` (${archivedCount})` : ''}` },
            ] as { id: FilterTab; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-widest transition-all duration-150 ${
                activeTab === tab.id
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Type filter */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as NotificationType | 'all')}
          className="px-3 py-1.5 rounded-xl border border-border bg-input text-foreground text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all appearance-none cursor-pointer"
        >
          {TYPE_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Notification list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-5 flex items-start gap-4 animate-pulse">
              <div className="w-9 h-9 rounded-xl bg-muted/50 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="w-48 h-4 bg-muted/50 rounded" />
                <div className="w-72 h-3 bg-muted/40 rounded" />
              </div>
              <div className="w-12 h-3 bg-muted/40 rounded" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-16 text-center">
          <div className="w-14 h-14 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-4">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </div>
          <p className="text-foreground font-medium mb-1">
            {activeTab === 'archived' ? 'No archived notifications' : 'All caught up'}
          </p>
          <p className="text-sm text-muted-foreground font-light">
            {activeTab === 'archived' ?'Archived notifications will appear here.' :'New case updates, documents, approvals, and deadline alerts will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((n) => {
            const meta = TYPE_META[n.notification_type] ?? TYPE_META.system;
            const isDismissing = actionLoading === n.id + '_dismiss';
            const isArchiving = actionLoading === n.id + '_archive';
            const isUnarchiving = actionLoading === n.id + '_unarchive';

            return (
              <div
                key={n.id}
                className={`group bg-card border rounded-2xl p-5 transition-all duration-200 hover:shadow-sm ${
                  !n.is_read ? 'border-border ring-1 ring-primary/10' : 'border-border/60'
                } ${n.is_archived ? 'opacity-70' : ''}`}
                onClick={() => !n.is_read && markRead(n.id)}
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: meta.bg, color: meta.color }}
                  >
                    {meta.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`text-sm font-semibold ${!n.is_read ? 'text-foreground' : 'text-foreground/80'}`}>
                          {n.title}
                        </p>
                        {!n.is_read && (
                          <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                        )}
                        <span
                          className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full"
                          style={{ background: meta.bg, color: meta.color }}
                        >
                          {meta.label}
                        </span>
                        {n.is_archived && (
                          <span className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                            Archived
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0 mt-0.5">
                        {timeAgo(n.created_at)}
                      </span>
                    </div>

                    {n.body && (
                      <p className="text-sm text-muted-foreground font-light leading-relaxed mb-2">
                        {n.body}
                      </p>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-wrap mt-2">
                      {n.link && (
                        <a
                          href={n.link}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                        >
                          View details
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
                          </svg>
                        </a>
                      )}

                      <div className="flex items-center gap-1 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                        {!n.is_archived ? (
                          <>
                            {!n.is_read && (
                              <button
                                onClick={(e) => { e.stopPropagation(); markRead(n.id); }}
                                title="Mark as read"
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              </button>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); archive(n.id); }}
                              disabled={isArchiving}
                              title="Archive"
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all disabled:opacity-40"
                            >
                              {isArchiving ? (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                                </svg>
                              ) : (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="21 8 21 21 3 21 3 8" />
                                  <rect x="1" y="3" width="22" height="5" />
                                  <line x1="10" y1="12" x2="14" y2="12" />
                                </svg>
                              )}
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}
                              disabled={isDismissing}
                              title="Dismiss"
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-40"
                            >
                              {isDismissing ? (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                                </svg>
                              ) : (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="18" y1="6" x2="6" y2="18" />
                                  <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                              )}
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); unarchive(n.id); }}
                            disabled={isUnarchiving}
                            title="Unarchive"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all disabled:opacity-40"
                          >
                            {isUnarchiving ? (
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                              </svg>
                            ) : (
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                              </svg>
                            )}
                            Restore
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
