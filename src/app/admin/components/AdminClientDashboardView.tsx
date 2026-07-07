'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClientRecord {
  id: string;
  user_id: string;
  inquiry_id: string;
  created_at: string;
  inquiry: {
    name: string;
    email: string;
    firm: string;
    service: string;
    status: string;
    booking_stage: string;
    calendly_start_time: string | null;
  } | null;
  invoices: { id: string; amount: number; status: string; due_date: string }[];
  documents: { id: string; file_name: string; created_at: string }[];
  retainer: { plan_name: string; amount: number; status: string } | null;
  actionItems: { id: string; title: string; status: string; priority: string }[];
  lastActivity: string | null;
}

interface AIEmailDraft {
  subject: string;
  body: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STAGE_PILL: Record<string, string> = {
  inquiry: 'bg-blue-50 text-blue-700 border-blue-200',
  consultation_booked: 'bg-purple-50 text-purple-700 border-purple-200',
  proposal_sent: 'bg-amber-50 text-amber-700 border-amber-200',
  active_client: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
  closed: 'bg-gray-100 text-gray-500 border-gray-200',
};

const STAGE_LABEL: Record<string, string> = {
  inquiry: 'Inquiry',
  consultation_booked: 'Booked',
  proposal_sent: 'Proposal Sent',
  active_client: 'Active Client',
  completed: 'Completed',
  closed: 'Closed',
};

const INV_PILL: Record<string, string> = {
  paid: 'bg-emerald-50 text-emerald-700',
  sent: 'bg-amber-50 text-amber-700',
  overdue: 'bg-red-50 text-red-700',
  draft: 'bg-gray-100 text-gray-500',
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminClientDashboardView() {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ClientRecord | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDraft, setAiDraft] = useState<AIEmailDraft | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [smsLoading, setSmsLoading] = useState(false);
  const [smsSent, setSmsSent] = useState(false);
  const [smsText, setSmsText] = useState('');

  const supabase = createClient();

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      // Get portal access records with inquiry data
      const { data: accessData } = await supabase
        .from('client_portal_access')
        .select('id, user_id, inquiry_id, created_at')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!accessData || accessData.length === 0) {
        setClients([]);
        setLoading(false);
        return;
      }

      const inquiryIds = accessData.map((a: { inquiry_id: string }) => a.inquiry_id).filter(Boolean);

      // Parallel fetches
      const [inquiriesRes, invoicesRes, docsRes, retainersRes, actionItemsRes] = await Promise.all([
        supabase.from('contact_inquiries').select('id,name,email,firm,service,status,booking_stage,calendly_start_time,updated_at').in('id', inquiryIds),
        supabase.from('client_invoices').select('id,inquiry_id,amount,status,due_date').in('inquiry_id', inquiryIds),
        supabase.from('case_documents').select('id,inquiry_id,file_name,created_at').in('inquiry_id', inquiryIds).order('created_at', { ascending: false }),
        supabase.from('retainer_subscriptions').select('user_id,plan_name,amount,status').in('user_id', accessData.map((a: { user_id: string }) => a.user_id)).eq('status', 'active'),
        supabase.from('consultation_action_items').select('id,inquiry_id,title,status,priority').in('inquiry_id', inquiryIds).neq('status', 'dismissed'),
      ]);

      const inquiries = inquiriesRes.data ?? [];
      const invoices = invoicesRes.data ?? [];
      const docs = docsRes.data ?? [];
      const retainers = retainersRes.data ?? [];
      const actionItems = actionItemsRes.data ?? [];

      const records: ClientRecord[] = accessData.map((access: { id: string; user_id: string; inquiry_id: string; created_at: string }) => {
        const inq = inquiries.find((i: { id: string }) => i.id === access.inquiry_id) ?? null;
        const clientInvoices = invoices.filter((inv: { inquiry_id: string }) => inv.inquiry_id === access.inquiry_id);
        const clientDocs = docs.filter((d: { inquiry_id: string }) => d.inquiry_id === access.inquiry_id).slice(0, 3);
        const retainer = retainers.find((r: { user_id: string }) => r.user_id === access.user_id) ?? null;
        const items = actionItems.filter((a: { inquiry_id: string }) => a.inquiry_id === access.inquiry_id);
        const lastActivity = inq?.updated_at ?? access.created_at;

        return {
          id: access.id,
          user_id: access.user_id,
          inquiry_id: access.inquiry_id,
          created_at: access.created_at,
          inquiry: inq,
          invoices: clientInvoices,
          documents: clientDocs,
          retainer,
          actionItems: items,
          lastActivity,
        };
      });

      setClients(records);
    } catch (err) {
      console.error('AdminClientDashboardView error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    return (
      !q ||
      c.inquiry?.name?.toLowerCase().includes(q) ||
      c.inquiry?.email?.toLowerCase().includes(q) ||
      c.inquiry?.firm?.toLowerCase().includes(q) ||
      c.inquiry?.service?.toLowerCase().includes(q)
    );
  });

  const generateAIEmail = async (client: ClientRecord) => {
    if (!client.inquiry) return;
    setAiLoading(true);
    setAiDraft(null);
    try {
      const pendingInvoices = client.invoices.filter((i) => i.status === 'sent' || i.status === 'overdue');
      const pendingItems = client.actionItems.filter((a) => a.status === 'pending');
      const prompt = `Draft a professional, warm follow-up email for a legal paralegal firm (Broussard Legal Services) to send to client ${client.inquiry.name} at ${client.inquiry.firm || 'their firm'}.

Context:
- Service: ${client.inquiry.service}
- Case Stage: ${STAGE_LABEL[client.inquiry.booking_stage] ?? client.inquiry.booking_stage}
- Pending invoices: ${pendingInvoices.length} (${pendingInvoices.map((i) => fmt(i.amount)).join(', ')})
- Pending action items: ${pendingItems.map((a) => a.title).join(', ') || 'None'}
- Retainer: ${client.retainer ? `${client.retainer.plan_name} — ${fmt(client.retainer.amount)}/mo` : 'None'}

Write a subject line and email body. Be professional, concise, and helpful. Sign as "Maggi May Broussard, Broussard Legal Services".

Format your response as:
SUBJECT: [subject line]
BODY:
[email body]`;

      const res = await fetch('/api/ai/chat-completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
      });

      if (res.ok) {
        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content ?? data?.content ?? '';
        const subjectMatch = content.match(/SUBJECT:\s*(.+)/);
        const bodyMatch = content.match(/BODY:\s*([\s\S]+)/);
        setAiDraft({
          subject: subjectMatch?.[1]?.trim() ?? `Follow-up: ${client.inquiry.service}`,
          body: bodyMatch?.[1]?.trim() ?? content,
        });
      }
    } catch {
      // Non-blocking
    } finally {
      setAiLoading(false);
    }
  };

  const generateAISMS = async (client: ClientRecord) => {
    if (!client.inquiry) return;
    setSmsLoading(true);
    setSmsText('');
    try {
      const prompt = `Write a brief, professional SMS reminder (max 160 characters) for legal paralegal Maggi May Broussard to send to client ${client.inquiry.name} regarding their ${client.inquiry.service} case. Stage: ${STAGE_LABEL[client.inquiry.booking_stage] ?? client.inquiry.booking_stage}. Be warm and action-oriented.`;

      const res = await fetch('/api/ai/chat-completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
      });

      if (res.ok) {
        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content ?? data?.content ?? '';
        setSmsText(content.trim().slice(0, 160));
      }
    } catch {
      // Non-blocking
    } finally {
      setSmsLoading(false);
    }
  };

  const sendEmail = async () => {
    if (!selected?.inquiry || !aiDraft) return;
    setSendingEmail(true);
    try {
      await fetch('/api/admin/send-client-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: selected.inquiry.email,
          subject: aiDraft.subject,
          body: aiDraft.body,
          clientName: selected.inquiry.name,
        }),
      });
      setEmailSent(true);
      setTimeout(() => setEmailSent(false), 3000);
    } catch {
      // Non-blocking
    } finally {
      setSendingEmail(false);
    }
  };

  const sendSMS = async () => {
    if (!selected?.inquiry || !smsText) return;
    try {
      await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: selected.inquiry.email, message: smsText, clientName: selected.inquiry.name }),
      });
      setSmsSent(true);
      setTimeout(() => setSmsSent(false), 3000);
    } catch {
      // Non-blocking
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
      </div>
    );
  }

  return (
    <div className="flex gap-6 h-full">
      {/* Client List */}
      <div className="flex-1 min-w-0">
        {/* Search */}
        <div className="mb-4">
          <div className="relative">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Search clients…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-input text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-sm">No portal clients found.</p>
            <p className="text-xs mt-1">Invite clients from the Clients tab to grant portal access.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((client) => {
              const stage = client.inquiry?.booking_stage ?? 'inquiry';
              const stagePill = STAGE_PILL[stage] ?? 'bg-gray-100 text-gray-500 border-gray-200';
              const stageLabel = STAGE_LABEL[stage] ?? stage;
              const overdueInvoices = client.invoices.filter((i) => i.status === 'overdue').length;
              const pendingItems = client.actionItems.filter((a) => a.status === 'pending').length;
              const isSelected = selected?.id === client.id;

              return (
                <button
                  key={client.id}
                  onClick={() => { setSelected(isSelected ? null : client); setAiDraft(null); setSmsText(''); }}
                  className={`w-full text-left rounded-2xl border p-4 transition-all ${isSelected ? 'border-primary/40 bg-primary/5' : 'bg-card border-border hover:border-primary/20'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-foreground text-sm">{client.inquiry?.name ?? 'Unknown'}</p>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${stagePill}`}>{stageLabel}</span>
                        {overdueInvoices > 0 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200">
                            {overdueInvoices} overdue
                          </span>
                        )}
                        {pendingItems > 0 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            {pendingItems} tasks
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{client.inquiry?.email}</p>
                      <p className="text-xs text-muted-foreground">{client.inquiry?.service}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {client.retainer && (
                        <p className="text-xs font-semibold text-primary">{fmt(client.retainer.amount)}/mo</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">{client.lastActivity ? formatDate(client.lastActivity) : '—'}</p>
                    </div>
                  </div>

                  {/* Quick stats */}
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/></svg>
                      {client.invoices.length} invoice{client.invoices.length !== 1 ? 's' : ''}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      {client.documents.length} doc{client.documents.length !== 1 ? 's' : ''}
                    </div>
                    {client.inquiry?.calendly_start_time && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        {formatDate(client.inquiry.calendly_start_time)}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {selected && (
        <div className="w-80 flex-shrink-0 flex flex-col gap-4">
          {/* Header */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-semibold text-foreground">{selected.inquiry?.name}</p>
                <p className="text-xs text-muted-foreground">{selected.inquiry?.email}</p>
                <p className="text-xs text-muted-foreground">{selected.inquiry?.firm}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STAGE_PILL[selected.inquiry?.booking_stage ?? 'inquiry'] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                {STAGE_LABEL[selected.inquiry?.booking_stage ?? 'inquiry'] ?? selected.inquiry?.booking_stage}
              </span>
              {selected.retainer && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                  Retainer: {fmt(selected.retainer.amount)}/mo
                </span>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <Link
                href={`/admin?tab=inquiries&id=${selected.inquiry_id}`}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
              >
                View Case
              </Link>
              <a
                href={`mailto:${selected.inquiry?.email}`}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all hover:opacity-90"
                style={{ background: '#355E3B', color: '#fff' }}
              >
                Email
              </a>
            </div>
          </div>

          {/* Invoices */}
          {selected.invoices.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-5">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">Invoices</p>
              <div className="flex flex-col gap-2">
                {selected.invoices.slice(0, 4).map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between">
                    <span className="text-sm text-foreground">{fmt(inv.amount)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${INV_PILL[inv.status] ?? 'bg-gray-100 text-gray-500'}`}>{inv.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Items */}
          {selected.actionItems.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-5">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">Action Items</p>
              <div className="flex flex-col gap-2">
                {selected.actionItems.slice(0, 4).map((item) => (
                  <div key={item.id} className="flex items-start gap-2">
                    <span className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.status === 'completed' ? 'bg-emerald-500' : item.priority === 'high' ? 'bg-red-500' : 'bg-amber-500'}`} />
                    <span className="text-xs text-foreground leading-relaxed">{item.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Actions */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
              </svg>
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">AI Actions</p>
            </div>

            {/* AI Email Draft */}
            <button
              onClick={() => generateAIEmail(selected)}
              disabled={aiLoading}
              className="w-full py-2 mb-2 rounded-xl border border-border text-xs font-semibold text-foreground hover:border-primary/40 hover:bg-primary/5 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {aiLoading ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              ) : '✉️'} Draft AI Follow-up Email
            </button>

            {aiDraft && (
              <div className="mb-3 p-3 bg-secondary/30 rounded-xl border border-border">
                <p className="text-xs font-semibold text-foreground mb-1">Subject: {aiDraft.subject}</p>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">{aiDraft.body}</p>
                <button
                  onClick={sendEmail}
                  disabled={sendingEmail}
                  className="mt-2 w-full py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90 disabled:opacity-60"
                  style={{ background: '#355E3B', color: '#fff' }}
                >
                  {emailSent ? '✓ Sent!' : sendingEmail ? 'Sending…' : 'Send Email'}
                </button>
              </div>
            )}

            {/* AI SMS */}
            <button
              onClick={() => generateAISMS(selected)}
              disabled={smsLoading}
              className="w-full py-2 rounded-xl border border-border text-xs font-semibold text-foreground hover:border-primary/40 hover:bg-primary/5 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {smsLoading ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              ) : '💬'} Draft AI SMS Reminder
            </button>

            {smsText && (
              <div className="mt-2 p-3 bg-secondary/30 rounded-xl border border-border">
                <p className="text-xs text-foreground leading-relaxed">{smsText}</p>
                <button
                  onClick={sendSMS}
                  disabled={smsSent}
                  className="mt-2 w-full py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90 disabled:opacity-60"
                  style={{ background: '#355E3B', color: '#fff' }}
                >
                  {smsSent ? '✓ Sent!' : 'Send SMS'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
