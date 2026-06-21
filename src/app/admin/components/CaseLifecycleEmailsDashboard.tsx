'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface EmailLog {
  id: string;
  inquiry_id: string | null;
  event_type: 'deliverable_approved' | 'case_stage_changed' | 'invoice_issued' | 'deadline_approaching';
  client_email: string;
  client_name: string;
  subject: string | null;
  resend_email_id: string | null;
  status: 'sent' | 'failed' | 'skipped';
  details: Record<string, unknown>;
  error_message: string | null;
  created_at: string;
}

interface CaseOption {
  id: string;
  name: string;
  email: string;
  firm: string;
  service: string;
  booking_stage: string | null;
}

interface SendEmailForm {
  eventType: 'deliverable_approved' | 'case_stage_changed' | 'invoice_issued' | 'deadline_approaching';
  inquiryId: string;
  clientEmail: string;
  clientName: string;
  // deliverable_approved
  fileName: string;
  deliverableType: string;
  statusNotes: string;
  // case_stage_changed
  newStage: string;
  previousStage: string;
  stageMessage: string;
  // invoice_issued
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  amount: string;
  paymentLink: string;
  invoiceNotes: string;
  // deadline_approaching
  deadlineTitle: string;
  deadlineDate: string;
  daysUntil: string;
  deadlineDescription: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const EVENT_CONFIG: Record<string, { label: string; icon: string; color: string; dot: string; description: string }> = {
  deliverable_approved: {
    label: 'Deliverable Approved',
    icon: '✅',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
    description: 'Sent when a case deliverable is approved and ready for client review',
  },
  case_stage_changed: {
    label: 'Case Stage Changed',
    icon: '🔄',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    dot: 'bg-blue-500',
    description: 'Sent when a case moves to a new stage in the lifecycle',
  },
  invoice_issued: {
    label: 'Invoice Issued',
    icon: '📄',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
    description: 'Sent when a new invoice is issued to the client',
  },
  deadline_approaching: {
    label: 'Deadline Approaching',
    icon: '⏰',
    color: 'bg-red-50 text-red-700 border-red-200',
    dot: 'bg-red-500',
    description: 'Sent when an important case deadline is approaching',
  },
};

const STAGE_OPTIONS = [
  { value: 'inquiry', label: 'Inquiry' },
  { value: 'consultation_booked', label: 'Consultation Booked' },
  { value: 'proposal_sent', label: 'Proposal Sent' },
  { value: 'active_client', label: 'Active Client' },
  { value: 'completed', label: 'Completed' },
];

const DELIVERABLE_TYPE_OPTIONS = [
  { value: 'intake_document', label: 'Intake Document' },
  { value: 'legal_research', label: 'Legal Research' },
  { value: 'draft', label: 'Draft' },
  { value: 'filing', label: 'Filing' },
  { value: 'correspondence', label: 'Correspondence' },
  { value: 'general', label: 'General' },
];

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function CaseLifecycleEmailsDashboard() {
  const supabase = createClient();

  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [cases, setCases] = useState<CaseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterEvent, setFilterEvent] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');

  // Send modal
  const [showSendModal, setShowSendModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState(false);

  const defaultForm: SendEmailForm = {
    eventType: 'deliverable_approved',
    inquiryId: '',
    clientEmail: '',
    clientName: '',
    fileName: '',
    deliverableType: 'general',
    statusNotes: '',
    newStage: 'active_client',
    previousStage: 'proposal_sent',
    stageMessage: '',
    invoiceNumber: '',
    invoiceDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    dueDate: '',
    amount: '',
    paymentLink: '',
    invoiceNotes: '',
    deadlineTitle: '',
    deadlineDate: '',
    daysUntil: '3',
    deadlineDescription: '',
  };
  const [form, setForm] = useState<SendEmailForm>(defaultForm);

  // ── Data Fetching ────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [logsResult, casesResult] = await Promise.all([
        supabase
          .from('case_lifecycle_email_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('contact_inquiries')
          .select('id, name, email, firm, service, booking_stage')
          .order('name'),
      ]);

      if (logsResult.error) throw logsResult.error;
      if (casesResult.error) throw casesResult.error;

      setLogs(logsResult.data ?? []);
      setCases(casesResult.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load email logs');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Auto-fill from case selection ────────────────────────────────────────────

  const handleCaseSelect = (inquiryId: string) => {
    const c = cases.find((x) => x.id === inquiryId);
    if (c) {
      setForm((prev) => ({
        ...prev,
        inquiryId,
        clientEmail: c.email,
        clientName: c.name,
        previousStage: c.booking_stage ?? 'inquiry',
      }));
    } else {
      setForm((prev) => ({ ...prev, inquiryId }));
    }
  };

  // ── Send Email ───────────────────────────────────────────────────────────────

  const handleSend = async () => {
    if (!form.clientEmail || !form.clientName) {
      setSendError('Client email and name are required.');
      return;
    }
    setSending(true);
    setSendError(null);
    setSendSuccess(false);

    try {
      let details: Record<string, unknown> = {};
      const selectedCase = cases.find((c) => c.id === form.inquiryId);

      if (form.eventType === 'deliverable_approved') {
        details = {
          fileName: form.fileName || 'Document',
          deliverableType: form.deliverableType,
          caseName: selectedCase?.name ?? null,
          statusNotes: form.statusNotes || null,
          approvedDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        };
      } else if (form.eventType === 'case_stage_changed') {
        details = {
          caseName: selectedCase?.name ?? 'Your Case',
          caseId: form.inquiryId,
          service: selectedCase?.service ?? 'Legal Services',
          previousStage: form.previousStage,
          newStage: form.newStage,
          message: form.stageMessage || null,
        };
      } else if (form.eventType === 'invoice_issued') {
        details = {
          invoiceNumber: form.invoiceNumber || 'INV-001',
          invoiceDate: form.invoiceDate,
          dueDate: form.dueDate || 'Upon Receipt',
          amount: parseFloat(form.amount) || 0,
          currency: 'usd',
          caseName: selectedCase?.name ?? null,
          notes: form.invoiceNotes || null,
          paymentLink: form.paymentLink || null,
        };
      } else if (form.eventType === 'deadline_approaching') {
        details = {
          deadlineTitle: form.deadlineTitle || 'Case Deadline',
          deadlineDate: form.deadlineDate,
          daysUntil: parseInt(form.daysUntil) || 3,
          caseName: selectedCase?.name ?? null,
          description: form.deadlineDescription || null,
        };
      }

      const res = await fetch('/api/case-lifecycle/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: form.eventType,
          clientEmail: form.clientEmail,
          clientName: form.clientName,
          inquiryId: form.inquiryId || undefined,
          details,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Failed to send email');

      setSendSuccess(true);
      await fetchData();
      setTimeout(() => {
        setShowSendModal(false);
        setSendSuccess(false);
        setForm(defaultForm);
      }, 1800);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  // ── Filtered Logs ────────────────────────────────────────────────────────────

  const filteredLogs = logs.filter((log) => {
    if (filterEvent !== 'all' && log.event_type !== filterEvent) return false;
    if (filterStatus !== 'all' && log.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !log.client_name.toLowerCase().includes(q) &&
        !log.client_email.toLowerCase().includes(q) &&
        !(log.subject ?? '').toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  // ── Stats ────────────────────────────────────────────────────────────────────

  const stats = {
    total: logs.length,
    sent: logs.filter((l) => l.status === 'sent').length,
    failed: logs.filter((l) => l.status === 'failed').length,
    deliverable: logs.filter((l) => l.event_type === 'deliverable_approved').length,
    stage: logs.filter((l) => l.event_type === 'case_stage_changed').length,
    invoice: logs.filter((l) => l.event_type === 'invoice_issued').length,
    deadline: logs.filter((l) => l.event_type === 'deadline_approaching').length,
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            Automated emails sent to clients at key case lifecycle moments — approvals, stage changes, invoices, and deadlines.
          </p>
        </div>
        <button
          onClick={() => { setShowSendModal(true); setSendError(null); setSendSuccess(false); setForm(defaultForm); }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors"
          style={{ backgroundColor: '#355E3B' }}
        >
          <span>✉️</span> Send Lifecycle Email
        </button>
      </div>

      {/* ── Event Type Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(EVENT_CONFIG).map(([key, cfg]) => {
          const count = logs.filter((l) => l.event_type === key).length;
          return (
            <div key={key} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{cfg.icon}</span>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{cfg.label}</span>
              </div>
              <p className="text-2xl font-bold text-foreground font-serif">{count}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{cfg.description}</p>
            </div>
          );
        })}
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-foreground font-serif">{stats.total}</p>
          <p className="text-xs text-muted-foreground mt-1">Total Sent</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600 font-serif">{stats.sent}</p>
          <p className="text-xs text-muted-foreground mt-1">Delivered</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-red-600 font-serif">{stats.failed}</p>
          <p className="text-xs text-muted-foreground mt-1">Failed</p>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search by client name, email, or subject…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <select
          value={filterEvent}
          onChange={(e) => setFilterEvent(e.target.value)}
          className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none"
        >
          <option value="all">All Event Types</option>
          {Object.entries(EVENT_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none"
        >
          <option value="all">All Statuses</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
          <option value="skipped">Skipped</option>
        </select>
        <button
          onClick={fetchData}
          className="px-3 py-2 text-sm border border-border rounded-lg bg-background hover:bg-secondary/40 transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {/* ── Email Logs Table ── */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>
      ) : filteredLogs.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <p className="text-3xl mb-3">✉️</p>
          <p className="text-base font-semibold text-foreground mb-1">No lifecycle emails yet</p>
          <p className="text-sm text-muted-foreground">
            Emails will appear here when deliverables are approved, case stages change, invoices are issued, or deadlines approach.
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/20">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Event</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Client</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Subject</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Sent At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredLogs.map((log) => {
                  const cfg = EVENT_CONFIG[log.event_type];
                  return (
                    <tr key={log.id} className="hover:bg-secondary/10 transition-colors">
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg?.color ?? 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                          <span>{cfg?.icon}</span>
                          <span className="hidden sm:inline">{cfg?.label ?? log.event_type}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{log.client_name}</p>
                        <p className="text-xs text-muted-foreground">{log.client_email}</p>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <p className="text-foreground truncate max-w-xs">{log.subject ?? '—'}</p>
                        {log.error_message && (
                          <p className="text-xs text-red-600 mt-0.5 truncate max-w-xs">{log.error_message}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                          log.status === 'sent' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          log.status === 'failed'? 'bg-red-50 text-red-700 border-red-200' : 'bg-gray-50 text-gray-600 border-gray-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            log.status === 'sent' ? 'bg-emerald-500' :
                            log.status === 'failed' ? 'bg-red-500' : 'bg-gray-400'
                          }`} />
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                        {formatDate(log.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-border bg-secondary/10">
            <p className="text-xs text-muted-foreground">
              Showing {filteredLogs.length} of {logs.length} emails
            </p>
          </div>
        </div>
      )}

      {/* ── Send Email Modal ── */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground font-serif">Send Lifecycle Email</h3>
              <button
                onClick={() => setShowSendModal(false)}
                className="text-muted-foreground hover:text-foreground transition-colors text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Event Type */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Event Type</label>
                <select
                  value={form.eventType}
                  onChange={(e) => setForm((p) => ({ ...p, eventType: e.target.value as SendEmailForm['eventType'] }))}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {Object.entries(EVENT_CONFIG).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.icon} {cfg.label}</option>
                  ))}
                </select>
              </div>

              {/* Case Selection */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Case (optional — auto-fills client info)</label>
                <select
                  value={form.inquiryId}
                  onChange={(e) => handleCaseSelect(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">— Select a case —</option>
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} — {c.service}</option>
                  ))}
                </select>
              </div>

              {/* Client Info */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Client Name *</label>
                  <input
                    type="text"
                    value={form.clientName}
                    onChange={(e) => setForm((p) => ({ ...p, clientName: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Full name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Client Email *</label>
                  <input
                    type="email"
                    value={form.clientEmail}
                    onChange={(e) => setForm((p) => ({ ...p, clientEmail: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="email@example.com"
                  />
                </div>
              </div>

              {/* ── Event-specific fields ── */}

              {form.eventType === 'deliverable_approved' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Document / File Name</label>
                    <input
                      type="text"
                      value={form.fileName}
                      onChange={(e) => setForm((p) => ({ ...p, fileName: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="e.g. Demand Letter Draft.pdf"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Deliverable Type</label>
                    <select
                      value={form.deliverableType}
                      onChange={(e) => setForm((p) => ({ ...p, deliverableType: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none"
                    >
                      {DELIVERABLE_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Approval Notes (optional)</label>
                    <textarea
                      value={form.statusNotes}
                      onChange={(e) => setForm((p) => ({ ...p, statusNotes: e.target.value }))}
                      rows={2}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none resize-none"
                      placeholder="Any notes for the client…"
                    />
                  </div>
                </>
              )}

              {form.eventType === 'case_stage_changed' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Previous Stage</label>
                      <select
                        value={form.previousStage}
                        onChange={(e) => setForm((p) => ({ ...p, previousStage: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none"
                      >
                        {STAGE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">New Stage</label>
                      <select
                        value={form.newStage}
                        onChange={(e) => setForm((p) => ({ ...p, newStage: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none"
                      >
                        {STAGE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Custom Message (optional)</label>
                    <textarea
                      value={form.stageMessage}
                      onChange={(e) => setForm((p) => ({ ...p, stageMessage: e.target.value }))}
                      rows={2}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none resize-none"
                      placeholder="Additional context for the client…"
                    />
                  </div>
                </>
              )}

              {form.eventType === 'invoice_issued' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Invoice Number</label>
                      <input
                        type="text"
                        value={form.invoiceNumber}
                        onChange={(e) => setForm((p) => ({ ...p, invoiceNumber: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none"
                        placeholder="INV-001"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Amount (USD)</label>
                      <input
                        type="number"
                        value={form.amount}
                        onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none"
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Invoice Date</label>
                      <input
                        type="text"
                        value={form.invoiceDate}
                        onChange={(e) => setForm((p) => ({ ...p, invoiceDate: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none"
                        placeholder="June 18, 2026"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Due Date</label>
                      <input
                        type="text"
                        value={form.dueDate}
                        onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none"
                        placeholder="July 3, 2026"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Payment Link (optional)</label>
                    <input
                      type="url"
                      value={form.paymentLink}
                      onChange={(e) => setForm((p) => ({ ...p, paymentLink: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none"
                      placeholder="https://…"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Notes (optional)</label>
                    <textarea
                      value={form.invoiceNotes}
                      onChange={(e) => setForm((p) => ({ ...p, invoiceNotes: e.target.value }))}
                      rows={2}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none resize-none"
                      placeholder="Any notes about this invoice…"
                    />
                  </div>
                </>
              )}

              {form.eventType === 'deadline_approaching' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Deadline Title</label>
                    <input
                      type="text"
                      value={form.deadlineTitle}
                      onChange={(e) => setForm((p) => ({ ...p, deadlineTitle: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none"
                      placeholder="e.g. Filing Deadline — Motion to Dismiss"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Deadline Date</label>
                      <input
                        type="text"
                        value={form.deadlineDate}
                        onChange={(e) => setForm((p) => ({ ...p, deadlineDate: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none"
                        placeholder="June 25, 2026"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Days Until Deadline</label>
                      <input
                        type="number"
                        value={form.daysUntil}
                        onChange={(e) => setForm((p) => ({ ...p, daysUntil: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none"
                        min="1"
                        max="30"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Description (optional)</label>
                    <textarea
                      value={form.deadlineDescription}
                      onChange={(e) => setForm((p) => ({ ...p, deadlineDescription: e.target.value }))}
                      rows={2}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none resize-none"
                      placeholder="What the client needs to know or do…"
                    />
                  </div>
                </>
              )}

              {sendError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{sendError}</div>
              )}
              {sendSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700 font-semibold">
                  ✅ Email sent successfully!
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
              <button
                onClick={() => setShowSendModal(false)}
                className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-secondary/40 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={sending || sendSuccess}
                className="px-5 py-2 text-sm font-semibold text-white rounded-lg transition-colors disabled:opacity-60"
                style={{ backgroundColor: '#355E3B' }}
              >
                {sending ? 'Sending…' : sendSuccess ? 'Sent ✓' : 'Send Email'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
