'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useChat } from '@/lib/hooks/useChat';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CaseNotification {
  id: string;
  inquiry_id: string | null;
  event_type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  client_name?: string;
  client_email?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

interface CaseOption {
  id: string;
  name: string;
  firm: string;
  service: string;
  status: string;
}

const EVENT_TYPES = [
  { value: 'deadline_approaching', label: 'Deadline Approaching', icon: '⏰' },
  { value: 'document_uploaded', label: 'Document Uploaded', icon: '📄' },
  { value: 'payment_received', label: 'Payment Received', icon: '💳' },
  { value: 'status_change', label: 'Status Change', icon: '🔄' },
  { value: 'retainer_low', label: 'Retainer Low', icon: '⚠️' },
  { value: 'case_milestone', label: 'Case Milestone', icon: '🎯' },
  { value: 'message_received', label: 'Message Received', icon: '💬' },
  { value: 'invoice_overdue', label: 'Invoice Overdue', icon: '🔴' },
];

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600 border-gray-200',
  medium: 'bg-blue-100 text-blue-700 border-blue-200',
  high: 'bg-amber-100 text-amber-700 border-amber-200',
  urgent: 'bg-red-100 text-red-700 border-red-200',
};

const PRIORITY_DOT: Record<string, string> = {
  low: 'bg-gray-400',
  medium: 'bg-blue-500',
  high: 'bg-amber-500',
  urgent: 'bg-red-500 animate-pulse',
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RealtimeCaseNotificationsDashboard() {
  const [notifications, setNotifications] = useState<CaseNotification[]>([]);
  const [cases, setCases] = useState<CaseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'urgent'>('all');
  const [showCompose, setShowCompose] = useState(false);

  // Compose form
  const [selectedCase, setSelectedCase] = useState('');
  const [eventType, setEventType] = useState('status_change');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [customContext, setCustomContext] = useState('');
  const [composedTitle, setComposedTitle] = useState('');
  const [composedMessage, setComposedMessage] = useState('');
  const [sending, setSending] = useState(false);

  const { response: aiResponse, isLoading: aiLoading, error: aiError, sendMessage } = useChat('OPEN_AI', 'gpt-4.1-mini', false);

  useEffect(() => {
    if (aiError) toast.error(aiError.message);
  }, [aiError]);

  // When AI responds, populate the composed message
  useEffect(() => {
    if (aiResponse && !aiLoading) {
      try {
        const parsed = JSON.parse(aiResponse);
        setComposedTitle(parsed.title || '');
        setComposedMessage(parsed.message || '');
      } catch {
        // If not JSON, use as message directly
        setComposedMessage(aiResponse);
      }
    }
  }, [aiResponse, aiLoading]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const [notifRes, casesRes] = await Promise.all([
        supabase
          .from('notifications')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('contact_inquiries')
          .select('id, name, firm, service, status')
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      if (notifRes.data) {
        const mapped: CaseNotification[] = notifRes.data.map((n: Record<string, unknown>) => ({
          id: String(n.id ?? ''),
          inquiry_id: n.inquiry_id ? String(n.inquiry_id) : null,
          event_type: String(n.notification_type ?? n.event_type ?? 'general'),
          title: String(n.title ?? 'Notification'),
          message: String(n.body ?? n.message ?? ''),
          is_read: Boolean(n.is_read),
          created_at: String(n.created_at ?? new Date().toISOString()),
          client_name: n.client_name ? String(n.client_name) : (n.metadata as Record<string, unknown>)?.client_name ? String((n.metadata as Record<string, unknown>).client_name) : undefined,
          client_email: n.client_email ? String(n.client_email) : undefined,
          priority: (['low', 'medium', 'high', 'urgent'].includes(String(n.priority)) ? n.priority : 'medium') as CaseNotification['priority'],
        }));
        setNotifications(mapped);
      }

      if (casesRes.data) {
        setCases(casesRes.data.map((c: Record<string, unknown>) => ({
          id: String(c.id ?? ''),
          name: String(c.name ?? ''),
          firm: String(c.firm ?? ''),
          service: String(c.service ?? ''),
          status: String(c.status ?? ''),
        })));
      }
    } catch {
      // Silently handle
    } finally {
      setLoading(false);
    }
  }, []);

  // Real-time subscription
  useEffect(() => {
    fetchData();
    const supabase = createClient();

    // Subscribe to new notifications
    const notifChannel = supabase
      .channel('realtime-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        const n = payload.new as Record<string, unknown>;
        const meta = (n.metadata as Record<string, unknown>) ?? {};
        const newNotif: CaseNotification = {
          id: String(n.id ?? ''),
          inquiry_id: n.inquiry_id ? String(n.inquiry_id) : null,
          event_type: String(n.notification_type ?? n.event_type ?? 'general'),
          title: String(n.title ?? 'Notification'),
          message: String(n.body ?? n.message ?? ''),
          is_read: false,
          created_at: String(n.created_at ?? new Date().toISOString()),
          client_name: meta.client_name ? String(meta.client_name) : undefined,
          priority: (['low', 'medium', 'high', 'urgent'].includes(String(n.priority)) ? n.priority : 'medium') as CaseNotification['priority'],
        };
        setNotifications((prev) => [newNotif, ...prev]);
        toast.success(`New notification: ${newNotif.title}`, { icon: '🔔' });
      })
      .subscribe();

    // Subscribe to case stage changes
    const caseChannel = supabase
      .channel('realtime-case-stages')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'contact_inquiries' }, (payload) => {
        const n = payload.new as Record<string, unknown>;
        const o = payload.old as Record<string, unknown>;
        if (n.booking_stage !== o.booking_stage) {
          const stageLabel = String(n.booking_stage ?? 'updated');
          toast(`Case stage updated: ${String(n.name ?? 'Client')} → ${stageLabel}`, {
            icon: '🔄',
            duration: 4000,
          });
          // Refresh cases list
          setCases((prev) =>
            prev.map((c) => c.id === String(n.id) ? { ...c, status: String(n.status ?? c.status) } : c)
          );
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(notifChannel);
      supabase.removeChannel(caseChannel);
    };
  }, [fetchData]);

  const markRead = async (id: string) => {
    const supabase = createClient();
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllRead = async () => {
    const supabase = createClient();
    await supabase.from('notifications').update({ is_read: true }).eq('is_read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    toast.success('All notifications marked as read');
  };

  const handleAIGenerate = () => {
    const caseInfo = cases.find((c) => c.id === selectedCase);
    const eventLabel = EVENT_TYPES.find((e) => e.value === eventType)?.label ?? eventType;
    const prompt = `You are a legal practice management assistant. Generate a professional case notification for a law firm.

Case: ${caseInfo ? `${caseInfo.name} (${caseInfo.firm}) — ${caseInfo.service}` : 'General case'}
Event Type: ${eventLabel}
Priority: ${priority}
Context: ${customContext || 'Standard notification'}

Return ONLY valid JSON with this exact structure:
{"title": "Short notification title (max 60 chars)", "message": "Professional notification message (2-3 sentences, clear and actionable)"}`;

    sendMessage([
      { role: 'system', content: 'You are a legal practice assistant. Always respond with valid JSON only.' },
      { role: 'user', content: prompt },
    ], { max_completion_tokens: 300 });
  };

  const handleSendNotification = async () => {
    if (!composedTitle || !composedMessage) {
      toast.error('Please generate or write a notification first');
      return;
    }
    setSending(true);
    try {
      const supabase = createClient();
      const caseInfo = cases.find((c) => c.id === selectedCase);
      await supabase.from('notifications').insert({
        inquiry_id: selectedCase || null,
        notification_type: eventType,
        title: composedTitle,
        body: composedMessage,
        is_read: false,
        audience: 'admin',
        metadata: {
          priority,
          client_name: caseInfo?.name ?? null,
          client_email: null,
        },
      });
      toast.success('Notification sent successfully');
      setShowCompose(false);
      setComposedTitle('');
      setComposedMessage('');
      setCustomContext('');
      fetchData();
    } catch {
      toast.error('Failed to send notification');
    } finally {
      setSending(false);
    }
  };

  const filtered = notifications.filter((n) => {
    if (filter === 'unread') return !n.is_read;
    if (filter === 'urgent') return n.priority === 'urgent' || n.priority === 'high';
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const urgentCount = notifications.filter((n) => n.priority === 'urgent').length;

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: notifications.length, icon: '🔔', color: 'text-foreground' },
          { label: 'Unread', value: unreadCount, icon: '📬', color: 'text-blue-600' },
          { label: 'Urgent', value: urgentCount, icon: '🚨', color: 'text-red-600' },
          { label: 'Today', value: notifications.filter((n) => new Date(n.created_at).toDateString() === new Date().toDateString()).length, icon: '📅', color: 'text-emerald-600' },
        ].map((stat) => (
          <div key={stat.label} className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{stat.icon}</span>
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">{stat.label}</p>
            </div>
            <p className={`text-3xl font-semibold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-secondary/40 rounded-xl p-1">
          {(['all', 'unread', 'urgent'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-widest transition-all ${
                filter === f ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f === 'all' ? 'All' : f === 'unread' ? `Unread (${unreadCount})` : `Urgent (${urgentCount})`}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="px-3 py-1.5 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
            >
              Mark All Read
            </button>
          )}
          <button
            onClick={() => setShowCompose(!showCompose)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all hover:opacity-90"
            style={{ background: '#355E3B', color: '#fff' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            AI Compose
          </button>
        </div>
      </div>

      {/* AI Compose Panel */}
      {showCompose && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(53,94,59,0.1)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
              </svg>
            </div>
            <div>
              <h3 className="font-serif text-lg text-foreground">AI-Powered Notification Composer</h3>
              <p className="text-xs text-muted-foreground">Generate professional case notifications with AI assistance</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Case / Client</label>
              <select
                value={selectedCase}
                onChange={(e) => setSelectedCase(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
              >
                <option value="">General Notification</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} — {c.service}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Event Type</label>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
              >
                {EVENT_TYPES.map((e) => (
                  <option key={e.value} value={e.value}>{e.icon} {e.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as CaseNotification['priority'])}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Context (optional)</label>
              <input
                type="text"
                value={customContext}
                onChange={(e) => setCustomContext(e.target.value)}
                placeholder="e.g. deadline in 3 days, retainer at 20%..."
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
              />
            </div>
          </div>

          <button
            onClick={handleAIGenerate}
            disabled={aiLoading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border text-sm font-semibold text-foreground hover:border-accent/50 transition-all disabled:opacity-60"
          >
            {aiLoading ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Generating…
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                </svg>
                Generate with AI
              </>
            )}
          </button>

          {(composedTitle || composedMessage) && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Notification Title</label>
                <input
                  type="text"
                  value={composedTitle}
                  onChange={(e) => setComposedTitle(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Notification Message</label>
                <textarea
                  rows={3}
                  value={composedMessage}
                  onChange={(e) => setComposedMessage(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all resize-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSendNotification}
                  disabled={sending}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-60"
                  style={{ background: '#355E3B', color: '#fff' }}
                >
                  {sending ? 'Sending…' : 'Send Notification'}
                </button>
                <button
                  onClick={() => { setComposedTitle(''); setComposedMessage(''); }}
                  className="px-4 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-all"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Notifications List */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-serif text-lg text-foreground">Live Notifications</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Real-time case activity feed — updates automatically</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-muted-foreground">Live</span>
          </div>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-start gap-4 p-4 rounded-xl border border-border animate-pulse">
                <div className="w-8 h-8 rounded-full bg-muted/40 shrink-0" />
                <div className="flex-1">
                  <div className="w-48 h-4 bg-muted/60 rounded mb-2" />
                  <div className="w-full h-3 bg-muted/40 rounded mb-1" />
                  <div className="w-32 h-3 bg-muted/30 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-4">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            </div>
            <p className="text-muted-foreground text-sm">No notifications found</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((notif) => {
              const eventInfo = EVENT_TYPES.find((e) => e.value === notif.event_type);
              return (
                <div
                  key={notif.id}
                  className={`flex items-start gap-4 px-6 py-4 transition-colors hover:bg-secondary/20 cursor-pointer ${!notif.is_read ? 'bg-blue-50/30' : ''}`}
                  onClick={() => !notif.is_read && markRead(notif.id)}
                >
                  <div className="relative shrink-0 mt-0.5">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base" style={{ background: 'rgba(53,94,59,0.08)' }}>
                      {eventInfo?.icon ?? '🔔'}
                    </div>
                    {!notif.is_read && (
                      <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-card" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className={`text-sm font-semibold text-foreground ${!notif.is_read ? 'font-bold' : ''}`}>{notif.title}</p>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${PRIORITY_COLORS[notif.priority]}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[notif.priority]}`} />
                          {notif.priority}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-1.5">{notif.message}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground/70">
                      {notif.client_name && (
                        <span className="flex items-center gap-1">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                          </svg>
                          {notif.client_name}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                        </svg>
                        {fmtDate(notif.created_at)}
                      </span>
                      {!notif.is_read && (
                        <span className="text-blue-600 font-medium">Click to mark read</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
