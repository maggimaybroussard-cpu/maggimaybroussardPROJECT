'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface DigestLog {
  id: string;
  client_email: string;
  client_name: string;
  cases_included: number;
  invoices_included: number;
  updates_included: number;
  documents_included: number;
  sent_at: string;
  status: 'sent' | 'failed' | 'skipped';
  error_message: string | null;
  triggered_by: string | null;
  frequency: 'daily' | 'weekly';
}

interface ActiveClient {
  email: string;
  name: string;
  firm: string;
  service: string;
  status: string;
  caseCount: number;
  preferredFrequency: 'daily' | 'weekly' | 'global';
}

// ─── Per-client frequency preferences (persisted in localStorage) ─────────────
function loadClientPrefs(): Record<string, { frequency: 'daily' | 'weekly' | 'global'; sendHour: number }> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem('digestClientPrefs') ?? '{}');
  } catch {
    return {};
  }
}

function saveClientPrefs(prefs: Record<string, { frequency: 'daily' | 'weekly' | 'global'; sendHour: number }>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('digestClientPrefs', JSON.stringify(prefs));
}

// ─── Digest Preview Modal ─────────────────────────────────────────────────────
interface DigestPreviewModalProps {
  client: ActiveClient;
  frequency: 'daily' | 'weekly';
  sendHour: number;
  onClose: () => void;
  onConfirmSend: () => void;
  sending: boolean;
}

function DigestPreviewModal({ client, frequency, sendHour, onClose, onConfirmSend, sending }: DigestPreviewModalProps) {
  const cadence = frequency === 'daily' ? 'Daily' : 'Weekly';
  const hourLabel = sendHour === 0 ? '12:00 AM' : sendHour < 12 ? `${sendHour}:00 AM` : sendHour === 12 ? '12:00 PM' : `${sendHour - 12}:00 PM`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Modal header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-serif text-lg text-foreground">Digest Preview</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Review before sending to {client.name}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Preview email mockup */}
        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Recipient info */}
          <div className="flex items-center gap-3 bg-secondary/40 rounded-xl px-4 py-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ background: '#4A3728' }}>
              {client.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{client.name}</p>
              <p className="text-xs text-muted-foreground">{client.email}{client.firm ? ` · ${client.firm}` : ''}</p>
            </div>
            <div className="ml-auto flex flex-col items-end gap-1">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${frequency === 'daily' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                {frequency === 'daily' ? '📅 Daily' : '📆 Weekly'}
              </span>
              <span className="text-[10px] text-muted-foreground">Scheduled: {hourLabel}</span>
            </div>
          </div>

          {/* Email subject preview */}
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="bg-secondary/30 px-4 py-2 border-b border-border">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Email Subject</p>
            </div>
            <div className="px-4 py-3">
              <p className="text-sm font-medium text-foreground">
                {frequency === 'daily' ? '📅 Your Daily Case Update' : '📆 Your Weekly Case Summary'} — Broussard Legal Services
              </p>
            </div>
          </div>

          {/* Content sections preview */}
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="bg-secondary/30 px-4 py-2 border-b border-border">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Digest Sections</p>
            </div>
            <div className="divide-y divide-border">
              {[
                { icon: '📁', title: 'Active Case Status', desc: `${client.caseCount} active case${client.caseCount !== 1 ? 's' : ''} · Current stage & milestones` },
                { icon: '🔔', title: frequency === 'daily' ? "Today's Updates" : "This Week's Updates", desc: 'Recent notes, activity, and attorney messages' },
                { icon: '📄', title: 'Recent Documents', desc: 'Newly uploaded files available for review' },
                { icon: '✅', title: 'Action Items', desc: 'Pending tasks requiring client attention' },
                { icon: '💳', title: 'Invoice & Billing Status', desc: 'Outstanding balances and payment history' },
              ].map((section) => (
                <div key={section.title} className="flex items-start gap-3 px-4 py-3">
                  <span className="text-base mt-0.5">{section.icon}</span>
                  <div>
                    <p className="text-xs font-semibold text-foreground">{section.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{section.desc}</p>
                  </div>
                  <span className="ml-auto text-[10px] text-green-600 font-semibold bg-green-50 px-2 py-0.5 rounded-full">Included</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer note */}
          <p className="text-[11px] text-muted-foreground text-center">
            This is a preview of the digest structure. Actual content will be populated from live case data at send time.
          </p>
        </div>

        {/* Modal actions */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirmSend}
            disabled={sending}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60 hover:opacity-90"
            style={{ background: '#355E3B' }}
          >
            {sending ? (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Sending…
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
                Confirm & Send
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const HOUR_OPTIONS = [
  { value: 6, label: '6:00 AM' },
  { value: 7, label: '7:00 AM' },
  { value: 8, label: '8:00 AM' },
  { value: 9, label: '9:00 AM' },
  { value: 10, label: '10:00 AM' },
  { value: 11, label: '11:00 AM' },
  { value: 12, label: '12:00 PM' },
  { value: 13, label: '1:00 PM' },
  { value: 14, label: '2:00 PM' },
  { value: 15, label: '3:00 PM' },
  { value: 16, label: '4:00 PM' },
  { value: 17, label: '5:00 PM' },
  { value: 18, label: '6:00 PM' },
];

export default function WeeklyDigestDashboard() {
  const supabase = createClient();

  const [logs, setLogs] = useState<DigestLog[]>([]);
  const [activeClients, setActiveClients] = useState<ActiveClient[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [loadingClients, setLoadingClients] = useState(true);

  const [frequency, setFrequency] = useState<'daily' | 'weekly'>('weekly');
  const [globalSendHour, setGlobalSendHour] = useState<number>(9);
  const [docTypeFilter, setDocTypeFilter] = useState<string>('');
  const [pendingReviewOnly, setPendingReviewOnly] = useState(false);
  const [sendingAll, setSendingAll] = useState(false);
  const [sendingClient, setSendingClient] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [filterEmail, setFilterEmail] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Per-client preferences
  const [clientPrefs, setClientPrefs] = useState<Record<string, { frequency: 'daily' | 'weekly' | 'global'; sendHour: number }>>({});
  const [showPrefsFor, setShowPrefsFor] = useState<string | null>(null);

  // Preview modal state
  const [previewClient, setPreviewClient] = useState<ActiveClient | null>(null);

  useEffect(() => {
    setClientPrefs(loadClientPrefs());
  }, []);

  const updateClientPref = (email: string, patch: Partial<{ frequency: 'daily' | 'weekly' | 'global'; sendHour: number }>) => {
    setClientPrefs((prev) => {
      const current = prev[email] ?? { frequency: 'global', sendHour: globalSendHour };
      const next = { ...prev, [email]: { ...current, ...patch } };
      saveClientPrefs(next);
      return next;
    });
  };

  const fetchLogs = useCallback(async () => {
    setLoadingLogs(true);
    const { data } = await supabase
      .from('weekly_digest_logs')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(100);
    setLogs(data ?? []);
    setLoadingLogs(false);
  }, [supabase]);

  const fetchActiveClients = useCallback(async () => {
    setLoadingClients(true);
    const { data } = await supabase
      .from('contact_inquiries')
      .select('email, name, firm, service, status')
      .in('status', ['active', 'in_progress', 'new', 'pending'])
      .order('updated_at', { ascending: false });

    if (data) {
      const clientMap = new Map<string, ActiveClient>();
      for (const row of data) {
        const key = row.email.toLowerCase();
        if (clientMap.has(key)) {
          clientMap.get(key)!.caseCount++;
        } else {
          clientMap.set(key, {
            email: row.email,
            name: row.name,
            firm: row.firm,
            service: row.service,
            status: row.status,
            caseCount: 1,
            preferredFrequency: 'global',
          });
        }
      }
      setActiveClients(Array.from(clientMap.values()));
    }
    setLoadingClients(false);
  }, [supabase]);

  useEffect(() => {
    fetchLogs();
    fetchActiveClients();
  }, [fetchLogs, fetchActiveClients]);

  const getEffectiveFrequency = (email: string): 'daily' | 'weekly' => {
    const pref = clientPrefs[email];
    if (pref && pref.frequency !== 'global') return pref.frequency;
    return frequency;
  };

  const triggerDigest = async (clientEmail?: string) => {
    setSendResult(null);
    if (clientEmail) {
      setSendingClient(clientEmail);
    } else {
      setSendingAll(true);
    }

    try {
      const payload: Record<string, unknown> = {
        frequency: clientEmail ? getEffectiveFrequency(clientEmail) : frequency,
        sendHour: clientEmail ? (clientPrefs[clientEmail]?.sendHour ?? globalSendHour) : globalSendHour,
      };
      if (clientEmail) payload.clientEmail = clientEmail;
      if (docTypeFilter) payload.docTypeFilter = docTypeFilter;
      if (pendingReviewOnly) payload.pendingReviewOnly = true;

      const res = await fetch('/api/admin/weekly-digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setSendResult({ type: 'error', message: data?.error ?? 'Failed to send digest.' });
      } else {
        const cadence = (clientEmail ? getEffectiveFrequency(clientEmail) : frequency) === 'daily' ? 'Daily' : 'Weekly';
        const msg = clientEmail
          ? `${cadence} digest sent to ${clientEmail}.`
          : `${cadence} digest sent to ${data.sent} of ${data.total} client${data.total !== 1 ? 's' : ''}.${data.errors?.length ? ` ${data.errors.length} error(s).` : ''}`;
        setSendResult({ type: 'success', message: msg });
        fetchLogs();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Network error.';
      setSendResult({ type: 'error', message });
    } finally {
      setSendingAll(false);
      setSendingClient(null);
      setPreviewClient(null);
    }
  };

  const filteredLogs = logs.filter((l) => {
    if (filterEmail && !l.client_email.toLowerCase().includes(filterEmail.toLowerCase()) && !l.client_name.toLowerCase().includes(filterEmail.toLowerCase())) return false;
    if (filterStatus && l.status !== filterStatus) return false;
    return true;
  });

  const sentCount = logs.filter((l) => l.status === 'sent').length;
  const failedCount = logs.filter((l) => l.status === 'failed').length;
  const lastSent = logs.find((l) => l.status === 'sent');

  const globalHourLabel = HOUR_OPTIONS.find((h) => h.value === globalSendHour)?.label ?? `${globalSendHour}:00`;

  return (
    <div className="space-y-8">
      {/* Digest Preview Modal */}
      {previewClient && (
        <DigestPreviewModal
          client={previewClient}
          frequency={getEffectiveFrequency(previewClient.email)}
          sendHour={clientPrefs[previewClient.email]?.sendHour ?? globalSendHour}
          onClose={() => setPreviewClient(null)}
          onConfirmSend={() => triggerDigest(previewClient.email)}
          sending={sendingClient === previewClient.email}
        />
      )}

      {/* Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Active Clients', value: loadingClients ? '—' : activeClients.length, icon: '👥', color: 'text-blue-600' },
          { label: 'Total Digests Sent', value: loadingLogs ? '—' : sentCount, icon: '📨', color: 'text-green-600' },
          { label: 'Failed Sends', value: loadingLogs ? '—' : failedCount, icon: '⚠️', color: 'text-red-600' },
          { label: 'Last Sent', value: lastSent ? new Date(lastSent.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Never', icon: '🕐', color: 'text-muted-foreground' },
        ].map((stat) => (
          <div key={stat.label} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{stat.icon}</span>
              <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">{stat.label}</p>
            </div>
            <p className={`text-2xl font-bold font-serif ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Send Result Banner */}
      {sendResult && (
        <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm font-medium ${
          sendResult.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <span className="text-base mt-0.5">{sendResult.type === 'success' ? '✅' : '❌'}</span>
          <span>{sendResult.message}</span>
          <button onClick={() => setSendResult(null)} className="ml-auto text-current opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Send Digest Panel */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="font-serif text-lg text-foreground">Send Client Digest</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Send a branded digest email to all active clients summarizing their case updates, documents, action items, and invoice status.</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Global Frequency Toggle */}
            <div className="flex items-center bg-secondary/60 border border-border rounded-xl p-1 gap-1">
              <button
                onClick={() => setFrequency('daily')}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  frequency === 'daily' ? 'bg-card text-foreground shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                📅 Daily
              </button>
              <button
                onClick={() => setFrequency('weekly')}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  frequency === 'weekly' ? 'bg-card text-foreground shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                📆 Weekly
              </button>
            </div>

            {/* Global Time-of-Day Scheduling */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground font-medium whitespace-nowrap flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                Send at:
              </label>
              <select
                value={globalSendHour}
                onChange={(e) => setGlobalSendHour(Number(e.target.value))}
                className="px-3 py-1.5 rounded-lg border border-border bg-card text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent/40"
              >
                {HOUR_OPTIONS.map((h) => (
                  <option key={h.value} value={h.value}>{h.label}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => triggerDigest()}
              disabled={sendingAll || activeClients.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60 hover:opacity-90"
              style={{ background: '#355E3B' }}
            >
              {sendingAll ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  Sending…
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                  Send {frequency === 'daily' ? 'Daily' : 'Weekly'} to All ({activeClients.length})
                </>
              )}
            </button>
          </div>
        </div>

        {/* Global schedule info banner */}
        <div className="px-6 py-3 bg-blue-50/60 border-b border-blue-100 flex items-center gap-2 text-xs text-blue-700">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          <span>
            Global schedule: <strong>{frequency === 'daily' ? 'Daily' : 'Weekly'}</strong> at <strong>{globalHourLabel} CT</strong> — clients with custom preferences will use their own schedule.
          </span>
        </div>

        {/* What's included info */}
        <div className="px-6 py-4 bg-secondary/30">
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-widest mb-3">Each digest includes:</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { icon: '📁', label: 'Active case status & stage' },
              { icon: '🔔', label: frequency === 'daily' ? "Today's updates & notes" : "This week's updates & notes" },
              { icon: '📄', label: 'Recent document uploads' },
              { icon: '✅', label: 'Pending action items' },
              { icon: '💳', label: 'Invoice status & balances' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-xs text-foreground/80">
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </div>
            ))}
          </div>

          {/* Document section filters */}
          <div className="mt-5 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-widest mb-3">Document Section Filters:</p>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground font-medium whitespace-nowrap">Document Type:</label>
                <select
                  value={docTypeFilter}
                  onChange={(e) => setDocTypeFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-border bg-card text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent/40"
                >
                  <option value="">All Types</option>
                  <option value="contract">Contracts Only</option>
                  <option value="filing">Filings Only</option>
                  <option value="correspondence">Correspondence Only</option>
                  <option value="invoice">Invoices Only</option>
                  <option value="evidence">Evidence Only</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <button
                onClick={() => setPendingReviewOnly((v) => !v)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                  pendingReviewOnly
                    ? 'bg-amber-50 border-amber-300 text-amber-800' :'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
                }`}
              >
                <span>⚠️</span>
                <span>Pending Review Only</span>
                {pendingReviewOnly && (
                  <span className="ml-1 w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-bold">✓</span>
                )}
              </button>

              {(docTypeFilter || pendingReviewOnly) && (
                <button
                  onClick={() => { setDocTypeFilter(''); setPendingReviewOnly(false); }}
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>

            {(docTypeFilter || pendingReviewOnly) && (
              <div className="mt-2 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <span>🔍</span>
                <span>
                  Document section will show{' '}
                  {docTypeFilter ? <strong>{docTypeFilter}s only</strong> : <span>all types</span>}
                  {pendingReviewOnly && <span> · <strong>pending client review</strong> documents highlighted</span>}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Active Clients List */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="font-serif text-lg text-foreground">Active Clients</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Set per-client frequency, schedule time, preview digest, or send individually.</p>
        </div>

        {loadingClients ? (
          <div className="flex items-center justify-center py-12">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin text-muted-foreground">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
          </div>
        ) : activeClients.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">No active clients found.</div>
        ) : (
          <div className="divide-y divide-border">
            {activeClients.map((client) => {
              const pref = clientPrefs[client.email] ?? { frequency: 'global', sendHour: globalSendHour };
              const effectiveFreq = pref.frequency === 'global' ? frequency : pref.frequency;
              const effectiveHour = HOUR_OPTIONS.find((h) => h.value === pref.sendHour)?.label ?? `${pref.sendHour}:00`;
              const isShowingPrefs = showPrefsFor === client.email;

              return (
                <div key={client.email} className="transition-colors">
                  {/* Main client row */}
                  <div className="flex items-center justify-between px-6 py-4 hover:bg-secondary/20">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ background: '#4A3728' }}>
                        {client.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{client.name}</p>
                        <p className="text-xs text-muted-foreground">{client.email}{client.firm ? ` · ${client.firm}` : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {/* Effective schedule badge */}
                      <div className="hidden md:flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{client.caseCount} case{client.caseCount !== 1 ? 's' : ''}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          client.status === 'active' || client.status === 'in_progress' ? 'bg-green-100 text-green-700' :
                          client.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'
                        }`}>{client.status.replace('_', ' ')}</span>
                        {/* Per-client schedule indicator */}
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          pref.frequency !== 'global' ? 'bg-violet-100 text-violet-700' : 'bg-secondary text-muted-foreground'
                        }`}>
                          {pref.frequency !== 'global' ? '⚙️ Custom' : '🌐 Global'}
                          {' · '}{effectiveFreq === 'daily' ? 'Daily' : 'Weekly'} · {effectiveHour}
                        </span>
                      </div>

                      {/* Preferences toggle */}
                      <button
                        onClick={() => setShowPrefsFor(isShowingPrefs ? null : client.email)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                          isShowingPrefs ? 'bg-violet-50 border-violet-300 text-violet-700' : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
                        }`}
                        title="Per-client preferences"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
                        </svg>
                        Prefs
                      </button>

                      {/* Preview button */}
                      <button
                        onClick={() => setPreviewClient(client)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
                        title="Preview digest before sending"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                        </svg>
                        Preview
                      </button>

                      {/* Send button */}
                      <button
                        onClick={() => triggerDigest(client.email)}
                        disabled={sendingClient === client.email || sendingAll}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all disabled:opacity-60"
                      >
                        {sendingClient === client.email ? (
                          <>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                            </svg>
                            Sending…
                          </>
                        ) : (
                          <>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                            </svg>
                            Send {effectiveFreq === 'daily' ? 'Daily' : 'Weekly'}
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Per-client preferences panel */}
                  {isShowingPrefs && (
                    <div className="px-6 py-4 bg-violet-50/60 border-t border-violet-100">
                      <p className="text-xs font-semibold text-violet-700 uppercase tracking-widest mb-3">
                        ⚙️ Custom Preferences for {client.name}
                      </p>
                      <div className="flex flex-wrap items-center gap-4">
                        {/* Per-client frequency */}
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-muted-foreground font-medium whitespace-nowrap">Frequency:</label>
                          <div className="flex items-center bg-white border border-border rounded-lg p-0.5 gap-0.5">
                            {(['global', 'daily', 'weekly'] as const).map((f) => (
                              <button
                                key={f}
                                onClick={() => updateClientPref(client.email, { frequency: f })}
                                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                                  pref.frequency === f
                                    ? 'bg-violet-600 text-white shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                {f === 'global' ? '🌐 Global' : f === 'daily' ? '📅 Daily' : '📆 Weekly'}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Per-client send time */}
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-muted-foreground font-medium whitespace-nowrap flex items-center gap-1">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                            </svg>
                            Send at:
                          </label>
                          <select
                            value={pref.sendHour}
                            onChange={(e) => updateClientPref(client.email, { sendHour: Number(e.target.value) })}
                            className="px-3 py-1.5 rounded-lg border border-border bg-white text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-violet-400/40"
                          >
                            {HOUR_OPTIONS.map((h) => (
                              <option key={h.value} value={h.value}>{h.label}</option>
                            ))}
                          </select>
                        </div>

                        {pref.frequency !== 'global' && (
                          <button
                            onClick={() => updateClientPref(client.email, { frequency: 'global', sendHour: globalSendHour })}
                            className="text-xs text-violet-600 hover:text-violet-800 underline underline-offset-2 transition-colors"
                          >
                            Reset to global
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-2">
                        {pref.frequency === 'global'
                          ? `Using global schedule: ${frequency === 'daily' ? 'Daily' : 'Weekly'} at ${globalHourLabel} CT`
                          : `Custom: ${pref.frequency === 'daily' ? 'Daily' : 'Weekly'} at ${effectiveHour} CT`}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Digest History */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="font-serif text-lg text-foreground">Send History</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Log of all digest emails sent.</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search by name or email…"
              value={filterEmail}
              onChange={(e) => setFilterEmail(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-border bg-input text-foreground text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 w-48"
            />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-border bg-input text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent/40"
            >
              <option value="">All Statuses</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
              <option value="skipped">Skipped</option>
            </select>
          </div>
        </div>

        {loadingLogs ? (
          <div className="flex items-center justify-center py-12">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin text-muted-foreground">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {logs.length === 0 ? 'No digests sent yet. Click "Send to All" to send the first digest.' : 'No results match your filters.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-widest">Client</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-widest hidden md:table-cell">Sent At</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-widest hidden md:table-cell">Freq.</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-widest hidden md:table-cell">Cases</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-widest hidden md:table-cell">Docs</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-widest hidden md:table-cell">Invoices</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-widest hidden md:table-cell">Updates</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-widest">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-foreground text-sm">{log.client_name}</p>
                      <p className="text-xs text-muted-foreground">{log.client_email}</p>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-muted-foreground hidden md:table-cell">{formatDate(log.sent_at)}</td>
                    <td className="px-5 py-3.5 text-center hidden md:table-cell">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                        log.frequency === 'daily' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                      }`}>
                        {log.frequency === 'daily' ? '📅 Daily' : '📆 Weekly'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center text-xs text-foreground hidden md:table-cell">{log.cases_included}</td>
                    <td className="px-5 py-3.5 text-center text-xs text-foreground hidden md:table-cell">{log.documents_included ?? 0}</td>
                    <td className="px-5 py-3.5 text-center text-xs text-foreground hidden md:table-cell">{log.invoices_included}</td>
                    <td className="px-5 py-3.5 text-center text-xs text-foreground hidden md:table-cell">{log.updates_included}</td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                        log.status === 'sent' ? 'bg-green-100 text-green-700' :
                        log.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {log.status === 'sent' ? '✓ Sent' : log.status === 'failed' ? '✗ Failed' : 'Skipped'}
                      </span>
                      {log.error_message && (
                        <p className="text-xs text-red-500 mt-1 max-w-xs">{log.error_message}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
