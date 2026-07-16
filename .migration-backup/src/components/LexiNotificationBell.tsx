'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface LexiNotification {
  id: string;
  title: string;
  body: string | null;
  metadata: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

export default function LexiNotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<LexiNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('notifications')
        .select('id, title, body, metadata, is_read, created_at')
        .eq('audience', 'admin')
        .eq('notification_type', 'system')
        .filter('metadata->>source', 'eq', 'lexi')
        .order('created_at', { ascending: false })
        .limit(30);
      setNotifications((data as LexiNotification[]) ?? []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Real-time subscription for new Lexi notifications
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('lexi-notifications-bell')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `audience=eq.admin`,
        },
        (payload) => {
          const n = payload.new as LexiNotification & { notification_type: string; metadata: Record<string, unknown> };
          if (n.notification_type === 'system' && n.metadata?.source === 'lexi') {
            setNotifications((prev) => [n, ...prev].slice(0, 30));
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (!unreadIds.length) return;
    const supabase = createClient();
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .in('id', unreadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const markRead = async (id: string) => {
    const supabase = createClient();
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const timeAgo = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const getPriorityColor = (metadata: Record<string, unknown>) => {
    const priority = metadata?.priority as string;
    if (priority === 'urgent') return 'bg-red-500';
    if (priority === 'high') return 'bg-amber-500';
    return 'bg-primary';
  };

  const getPriorityBadge = (metadata: Record<string, unknown>) => {
    const priority = metadata?.priority as string;
    if (priority === 'urgent') return { label: 'Urgent', cls: 'bg-red-50 text-red-700 border-red-200' };
    if (priority === 'high') return { label: 'High', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
    return { label: 'Info', cls: 'bg-primary/10 text-primary border-primary/20' };
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={() => { setOpen((p) => !p); if (!open) fetchNotifications(); }}
        className="relative inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
        title="Lexi Notifications"
      >
        {/* Lexi avatar dot */}
        <span className="relative flex items-center justify-center w-4 h-4">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
        </span>
        <span className="hidden sm:inline">Lexi</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-card border border-border rounded-2xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-primary/5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">Lexi Alerts</p>
                <p className="text-[10px] text-muted-foreground">Push notifications from your AI legal secretary</p>
              </div>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-[10px] text-primary hover:underline font-medium"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center mb-3">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                  </svg>
                </div>
                <p className="text-xs font-medium text-foreground mb-1">No alerts yet</p>
                <p className="text-[11px] text-muted-foreground">Lexi will push important alerts here when she detects urgent matters in conversations.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {notifications.map((n) => {
                  const badge = getPriorityBadge(n.metadata);
                  return (
                    <div
                      key={n.id}
                      onClick={() => markRead(n.id)}
                      className={`px-4 py-3 cursor-pointer hover:bg-secondary/40 transition-colors ${!n.is_read ? 'bg-primary/3' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${!n.is_read ? getPriorityColor(n.metadata) : 'bg-border'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <p className={`text-xs font-semibold truncate ${!n.is_read ? 'text-foreground' : 'text-muted-foreground'}`}>
                              {n.title}
                            </p>
                            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${badge.cls} shrink-0`}>
                              {badge.label}
                            </span>
                          </div>
                          {n.body && (
                            <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2 mb-1">
                              {n.body}
                            </p>
                          )}
                          {n.metadata?.topic && (
                            <span className="inline-block text-[10px] bg-secondary text-muted-foreground px-2 py-0.5 rounded-full border border-border mb-1">
                              {String(n.metadata.topic)}
                            </span>
                          )}
                          <p className="text-[10px] text-muted-foreground/70">{timeAgo(n.created_at)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-border bg-secondary/30 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <p className="text-[10px] text-muted-foreground">Lexi is monitoring conversations</p>
            </div>
            <p className="text-[10px] text-muted-foreground">{notifications.length} total</p>
          </div>
        </div>
      )}
    </div>
  );
}
