'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TimelineEvent {
  id: string;
  kind: 'case_created' | 'document' | 'payment' | 'message' | 'milestone' | 'task' | 'status_change';
  timestamp: string;
  title: string;
  description: string | null;
  badge?: string;
  badgeColor?: string;
  amount?: number;
  currency?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatCurrency(amount: number, currency = 'usd') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

const KIND_CONFIG: Record<string, { icon: React.ReactNode; dotColor: string; lineColor: string }> = {
  case_created: {
    dotColor: '#355E3B',
    lineColor: 'rgba(53,94,59,0.2)',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
    ),
  },
  document: {
    dotColor: '#2563EB',
    lineColor: 'rgba(37,99,235,0.2)',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
      </svg>
    ),
  },
  payment: {
    dotColor: '#059669',
    lineColor: 'rgba(5,150,105,0.2)',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
      </svg>
    ),
  },
  message: {
    dotColor: '#7C3AED',
    lineColor: 'rgba(124,58,237,0.2)',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  milestone: {
    dotColor: '#C8965A',
    lineColor: 'rgba(200,150,90,0.2)',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
  },
  task: {
    dotColor: '#0891B2',
    lineColor: 'rgba(8,145,178,0.2)',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    ),
  },
  status_change: {
    dotColor: '#6B7280',
    lineColor: 'rgba(107,114,128,0.2)',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
  },
};

// ── Main Component ─────────────────────────────────────────────────────────────

export default function CaseTimeline() {
  const { user } = useAuth();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const fetchTimeline = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: accessData } = await supabase
        .from('client_portal_access')
        .select('inquiry_id')
        .eq('user_id', user.id)
        .maybeSingle();

      const inquiryId = accessData?.inquiry_id ?? null;
      if (!inquiryId) {
        setLoading(false);
        return;
      }

      const [inquiryRes, docsRes, invoicesRes, messagesRes, tasksRes] = await Promise.all([
        supabase.from('contact_inquiries').select('id,name,service,status,booking_stage,created_at,updated_at').eq('id', inquiryId).single(),
        supabase.from('case_documents').select('id,file_name,category,created_at,uploaded_by_role').eq('inquiry_id', inquiryId).order('created_at', { ascending: false }).limit(20),
        supabase.from('client_invoices').select('id,invoice_number,amount,currency,status,created_at').eq('inquiry_id', inquiryId).order('created_at', { ascending: false }).limit(10),
        supabase.from('portal_messages').select('id,sender_role,body,created_at').eq('inquiry_id', inquiryId).order('created_at', { ascending: false }).limit(10),
        supabase.from('admin_tasks').select('id,title,status,created_at,updated_at').eq('case_id', inquiryId).order('created_at', { ascending: false }).limit(10),
      ]);

      const allEvents: TimelineEvent[] = [];

      // Case created
      if (inquiryRes.data) {
        allEvents.push({
          id: `case_${inquiryRes.data.id}`,
          kind: 'case_created',
          timestamp: inquiryRes.data.created_at,
          title: 'Case Opened',
          description: `${inquiryRes.data.service} matter initiated`,
          badge: 'New Matter',
          badgeColor: '#355E3B',
        });
      }

      // Documents
      (docsRes.data ?? []).forEach(doc => {
        allEvents.push({
          id: `doc_${doc.id}`,
          kind: 'document',
          timestamp: doc.created_at,
          title: doc.file_name,
          description: `${doc.category ?? 'Document'} uploaded by ${doc.uploaded_by_role === 'admin' ? 'attorney' : 'you'}`,
          badge: doc.category ?? 'Document',
          badgeColor: '#2563EB',
        });
      });

      // Invoices
      (invoicesRes.data ?? []).forEach(inv => {
        allEvents.push({
          id: `inv_${inv.id}`,
          kind: 'payment',
          timestamp: inv.created_at,
          title: inv.status === 'paid' ? `Invoice #${inv.invoice_number} Paid` : `Invoice #${inv.invoice_number} Issued`,
          description: null,
          badge: inv.status === 'paid' ? 'Paid' : 'Invoice',
          badgeColor: inv.status === 'paid' ? '#059669' : '#C8965A',
          amount: inv.amount,
          currency: inv.currency,
        });
      });

      // Messages
      (messagesRes.data ?? []).forEach(msg => {
        allEvents.push({
          id: `msg_${msg.id}`,
          kind: 'message',
          timestamp: msg.created_at,
          title: msg.sender_role === 'admin' ? 'Message from Attorney' : 'Message Sent',
          description: msg.body.length > 80 ? msg.body.slice(0, 80) + '…' : msg.body,
          badge: msg.sender_role === 'admin' ? 'From Attorney' : 'From You',
          badgeColor: '#7C3AED',
        });
      });

      // Tasks
      (tasksRes.data ?? []).forEach(task => {
        if (task.status === 'done') {
          allEvents.push({
            id: `task_${task.id}`,
            kind: 'task',
            timestamp: task.updated_at,
            title: `Task Completed: ${task.title}`,
            description: null,
            badge: 'Completed',
            badgeColor: '#0891B2',
          });
        }
      });

      // Sort by timestamp descending
      allEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setEvents(allEvents);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  const displayedEvents = showAll ? events : events.slice(0, 8);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-8 h-8 rounded-full bg-muted/40 shrink-0" />
            <div className="flex-1">
              <div className="w-32 h-3 bg-muted/50 rounded mb-2" />
              <div className="w-48 h-3 bg-muted/40 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-xs text-muted-foreground">No timeline events yet. Activity will appear here as your case progresses.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-4 top-0 bottom-0 w-px bg-border/60" />

        <div className="space-y-0">
          {displayedEvents.map((event, idx) => {
            const cfg = KIND_CONFIG[event.kind] ?? KIND_CONFIG.status_change;
            const isLast = idx === displayedEvents.length - 1;
            return (
              <div key={event.id} className={`relative flex gap-4 ${isLast ? '' : 'pb-5'}`}>
                {/* Dot */}
                <div
                  className="relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 border-background"
                  style={{ background: `${cfg.dotColor}15`, color: cfg.dotColor, borderColor: 'var(--background)' }}
                >
                  {cfg.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pt-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground leading-snug">{event.title}</p>
                      {event.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{event.description}</p>
                      )}
                      {event.amount !== undefined && (
                        <p className="text-xs font-semibold mt-0.5" style={{ color: cfg.dotColor }}>
                          {formatCurrency(event.amount, event.currency)}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      {event.badge && (
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold mb-1"
                          style={{ background: `${event.badgeColor}15`, color: event.badgeColor, border: `1px solid ${event.badgeColor}30` }}
                        >
                          {event.badge}
                        </span>
                      )}
                      <p className="text-[10px] text-muted-foreground/60 block">{formatDateTime(event.timestamp)}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {events.length > 8 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-4 w-full py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors border border-border rounded-xl hover:border-foreground/20"
        >
          {showAll ? 'Show Less' : `Show ${events.length - 8} More Events`}
        </button>
      )}
    </div>
  );
}
