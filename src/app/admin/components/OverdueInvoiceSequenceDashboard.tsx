'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OverdueSequence {
  id: string;
  invoice_id: string;
  inquiry_id: string | null;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  invoice_number: string | null;
  amount_due: number;
  due_date: string;
  days_overdue: number;
  tier: number;
  email_sent_7d: boolean;
  sms_sent_7d: boolean;
  email_sent_14d: boolean;
  sms_sent_14d: boolean;
  email_sent_30d: boolean;
  sms_sent_30d: boolean;
  final_notice_sent: boolean;
  final_notice_sent_at: string | null;
  portal_suspended: boolean;
  portal_suspended_at: string | null;
  sequence_stage: string | null;
  notes: string | null;
  resolved: boolean;
  last_action_at: string | null;
  created_at: string;
}

interface SequenceStats {
  total: number;
  stage_7d: number;
  stage_14d: number;
  stage_30d: number;
  final_notice: number;
  suspended: number;
  total_amount_overdue: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getStageInfo(seq: OverdueSequence): { label: string; color: string; bg: string; border: string; dot: string } {
  if (seq.portal_suspended) return { label: 'Portal Suspended', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', dot: 'bg-red-600' };
  if (seq.final_notice_sent) return { label: 'Final Notice Sent', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', dot: 'bg-red-500' };
  if (seq.email_sent_30d) return { label: '30-Day Warning Sent', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', dot: 'bg-orange-500' };
  if (seq.email_sent_14d) return { label: '14-Day Notice Sent', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500' };
  if (seq.email_sent_7d) return { label: '7-Day Reminder Sent', color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200', dot: 'bg-yellow-500' };
  return { label: 'Pending First Contact', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', dot: 'bg-blue-400' };
}

function getNextAction(seq: OverdueSequence): string {
  if (seq.portal_suspended) return 'Portal suspended — awaiting payment';
  if (seq.days_overdue >= 45) return 'Portal suspension triggered at next run';
  if (seq.final_notice_sent) return `Portal suspension in ${45 - seq.days_overdue} days`;
  if (seq.days_overdue >= 37 && !seq.final_notice_sent) return 'Final notice pending';
  if (seq.email_sent_30d && seq.days_overdue < 37) return `Final notice in ${37 - seq.days_overdue} days`;
  if (seq.days_overdue >= 30 && !seq.email_sent_30d) return '30-day warning pending';
  if (seq.email_sent_14d && seq.days_overdue < 30) return `30-day warning in ${30 - seq.days_overdue} days`;
  if (seq.days_overdue >= 14 && !seq.email_sent_14d) return '14-day notice pending';
  if (seq.email_sent_7d && seq.days_overdue < 14) return `14-day notice in ${14 - seq.days_overdue} days`;
  if (seq.days_overdue >= 7 && !seq.email_sent_7d) return '7-day reminder pending';
  return '—';
}

// ─── Stage Progress Bar ───────────────────────────────────────────────────────

function StageProgressBar({ seq }: { seq: OverdueSequence }) {
  const steps = [
    { label: '7d', done: seq.email_sent_7d, active: seq.days_overdue >= 7 && !seq.email_sent_7d },
    { label: '14d', done: seq.email_sent_14d, active: seq.days_overdue >= 14 && !seq.email_sent_14d },
    { label: '30d', done: seq.email_sent_30d, active: seq.days_overdue >= 30 && !seq.email_sent_30d },
    { label: 'Final', done: seq.final_notice_sent, active: seq.days_overdue >= 37 && !seq.final_notice_sent },
    { label: 'Suspend', done: seq.portal_suspended, active: seq.days_overdue >= 45 && !seq.portal_suspended },
  ];

  return (
    <div className="flex items-center gap-1 mt-2">
      {steps.map((step, i) => (
        <React.Fragment key={step.label}>
          <div className="flex flex-col items-center">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold border transition-all ${
              step.done
                ? 'bg-green-500 border-green-500 text-white'
                : step.active
                ? 'bg-amber-400 border-amber-400 text-white animate-pulse' :'bg-secondary border-border text-muted-foreground'
            }`}>
              {step.done ? '✓' : i + 1}
            </div>
            <span className="text-[9px] text-muted-foreground mt-0.5 leading-none">{step.label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`flex-1 h-0.5 mb-3 ${step.done ? 'bg-green-400' : 'bg-border'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OverdueInvoiceSequenceDashboard() {
  const supabase = createClient();
  const [sequences, setSequences] = useState<OverdueSequence[]>([]);
  const [stats, setStats] = useState<SequenceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<{ sequencesProcessed: number; emailsSent: number; smsSent: number; portalSuspensions: number } | null>(null);
  const [sendSms, setSendSms] = useState(true);
  const [sendEmails, setSendEmails] = useState(true);
  const [dryRun, setDryRun] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [stageFilter, setStageFilter] = useState<'all' | 'pending' | 'suspended'>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchSequences = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/overdue-invoice-sequences');
      if (!res.ok) throw new Error('Failed to fetch sequences');
      const data = await res.json();
      setSequences(data.sequences ?? []);
      setStats(data.stats ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSequences();
  }, [fetchSequences]);

  const handleRunSequences = async () => {
    setRunning(true);
    setError(null);
    setRunResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/overdue-invoice-sequences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ action: 'run_sequences', send_emails: sendEmails, send_sms: sendSms, dry_run: dryRun }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Run failed');
      setRunResult({ sequencesProcessed: data.sequencesProcessed ?? 0, emailsSent: data.emailsSent ?? 0, smsSent: data.smsSent ?? 0, portalSuspensions: data.portalSuspensions ?? 0 });
      await fetchSequences();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Run failed');
    } finally {
      setRunning(false);
    }
  };

  const handleResolve = async (sequenceId: string) => {
    setActionLoading(sequenceId + '_resolve');
    try {
      const res = await fetch('/api/admin/overdue-invoice-sequences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve', sequenceId }),
      });
      if (!res.ok) throw new Error('Resolve failed');
      setSequences((prev) => prev.filter((s) => s.id !== sequenceId));
      setStats((prev) => prev ? { ...prev, total: prev.total - 1 } : prev);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Resolve failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnsuspend = async (seq: OverdueSequence) => {
    setActionLoading(seq.id + '_unsuspend');
    try {
      const res = await fetch('/api/admin/overdue-invoice-sequences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unsuspend_portal', sequenceId: seq.id, inquiryId: seq.inquiry_id }),
      });
      if (!res.ok) throw new Error('Unsuspend failed');
      await fetchSequences();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unsuspend failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveNote = async (sequenceId: string) => {
    setSavingNote(true);
    try {
      const res = await fetch('/api/admin/overdue-invoice-sequences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_note', sequenceId, notes: noteText }),
      });
      if (!res.ok) throw new Error('Save note failed');
      setSequences((prev) => prev.map((s) => s.id === sequenceId ? { ...s, notes: noteText } : s));
      setNoteText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save note failed');
    } finally {
      setSavingNote(false);
    }
  };

  const filteredSequences = sequences.filter((s) => {
    if (stageFilter === 'suspended') return s.portal_suspended;
    if (stageFilter === 'pending') return !s.portal_suspended;
    return true;
  });

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-64 bg-secondary animate-pulse rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-secondary animate-pulse rounded-2xl" />)}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-28 bg-secondary animate-pulse rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center text-red-600 text-sm">⚠</span>
            Overdue Invoice Sequence
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Automated reminders at 7, 14, 30 days · Final notice · Portal suspension at 45 days
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Dry run toggle */}
          <button
            onClick={() => setDryRun((v) => !v)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-all font-medium ${dryRun ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-secondary border-border text-muted-foreground hover:text-foreground'}`}
          >
            {dryRun ? '🔍 Dry Run ON' : 'Dry Run'}
          </button>
          {/* SMS toggle */}
          <button
            onClick={() => setSendSms((v) => !v)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-all font-medium ${sendSms ? 'bg-green-50 border-green-200 text-green-700' : 'bg-secondary border-border text-muted-foreground'}`}
          >
            SMS {sendSms ? 'ON' : 'OFF'}
          </button>
          {/* Email toggle */}
          <button
            onClick={() => setSendEmails((v) => !v)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-all font-medium ${sendEmails ? 'bg-green-50 border-green-200 text-green-700' : 'bg-secondary border-border text-muted-foreground'}`}
          >
            Email {sendEmails ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={handleRunSequences}
            disabled={running}
            className="text-sm font-semibold px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {running ? (
              <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Processing…</>
            ) : (
              <>▶ Run Sequence Now</>
            )}
          </button>
        </div>
      </div>

      {/* Run Result Banner */}
      {runResult && (
        <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4 flex items-start gap-3">
          <span className="text-green-600 text-lg mt-0.5">✓</span>
          <div>
            <p className="text-sm font-semibold text-green-800">Sequence run complete{dryRun ? ' (Dry Run)' : ''}</p>
            <p className="text-xs text-green-700 mt-0.5">
              {runResult.sequencesProcessed} invoices processed · {runResult.emailsSent} emails sent · {runResult.smsSent} SMS sent · {runResult.portalSuspensions} portals suspended
            </p>
          </div>
          <button onClick={() => setRunResult(null)} className="ml-auto text-green-500 hover:text-green-700 text-lg leading-none">×</button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 flex items-start gap-3">
          <span className="text-red-500 text-lg mt-0.5">⚠</span>
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600 text-lg leading-none">×</button>
        </div>
      )}

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Total Active', value: stats.total, color: 'text-foreground', bg: 'bg-card' },
            { label: '7-Day Stage', value: stats.stage_7d, color: 'text-yellow-700', bg: 'bg-yellow-50' },
            { label: '14-Day Stage', value: stats.stage_14d, color: 'text-amber-700', bg: 'bg-amber-50' },
            { label: '30-Day Stage', value: stats.stage_30d, color: 'text-orange-700', bg: 'bg-orange-50' },
            { label: 'Final Notice', value: stats.final_notice, color: 'text-red-600', bg: 'bg-red-50' },
            { label: 'Suspended', value: stats.suspended, color: 'text-red-800', bg: 'bg-red-100' },
          ].map((stat) => (
            <div key={stat.label} className={`${stat.bg} border border-border rounded-2xl p-4 text-center`}>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Total Overdue Amount */}
      {stats && stats.total_amount_overdue > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-3 flex items-center justify-between">
          <span className="text-sm font-medium text-red-800">Total Outstanding Overdue Amount</span>
          <span className="text-lg font-bold text-red-700">{fmt(stats.total_amount_overdue)}</span>
        </div>
      )}

      {/* Sequence Stage Legend */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Automated Sequence Timeline</p>
        <div className="flex flex-wrap gap-3 text-xs">
          {[
            { day: 'Day 7', action: 'Email + SMS reminder', color: 'bg-yellow-400' },
            { day: 'Day 14', action: 'Email + SMS escalation', color: 'bg-amber-500' },
            { day: 'Day 30', action: 'Email + SMS final warning', color: 'bg-orange-500' },
            { day: 'Day 37', action: 'Final notice email + SMS', color: 'bg-red-500' },
            { day: 'Day 45', action: 'Portal access suspended', color: 'bg-red-800' },
          ].map((step) => (
            <div key={step.day} className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-2">
              <div className={`w-2 h-2 rounded-full ${step.color}`} />
              <span className="font-semibold text-foreground">{step.day}:</span>
              <span className="text-muted-foreground">{step.action}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(['all', 'pending', 'suspended'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setStageFilter(f)}
            className={`text-xs font-semibold px-4 py-2 rounded-xl border transition-all capitalize ${stageFilter === f ? 'bg-foreground text-background border-foreground' : 'bg-card border-border text-muted-foreground hover:text-foreground'}`}
          >
            {f === 'all' ? `All (${sequences.length})` : f === 'suspended' ? `Suspended (${sequences.filter((s) => s.portal_suspended).length})` : `Active (${sequences.filter((s) => !s.portal_suspended).length})`}
          </button>
        ))}
      </div>

      {/* Sequences List */}
      {filteredSequences.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-4 text-2xl">✓</div>
          <p className="text-sm font-semibold text-foreground">No overdue invoices in sequence</p>
          <p className="text-xs text-muted-foreground mt-1">All invoices are current or resolved. Run the sequence to scan for new overdue invoices.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSequences.map((seq) => {
            const stageInfo = getStageInfo(seq);
            const nextAction = getNextAction(seq);
            const isExpanded = expandedId === seq.id;

            return (
              <div
                key={seq.id}
                className={`bg-card border rounded-2xl overflow-hidden transition-all ${seq.portal_suspended ? 'border-red-300' : 'border-border'}`}
              >
                {/* Main Row */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${stageInfo.dot}`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-foreground">{seq.client_name ?? 'Unknown Client'}</p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${stageInfo.bg} ${stageInfo.color} border ${stageInfo.border}`}>
                            {stageInfo.label}
                          </span>
                          {seq.portal_suspended && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                              🔒 Portal Locked
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Invoice #{seq.invoice_number ?? 'N/A'} · Due {fmtDate(seq.due_date)} · <span className="font-semibold text-red-600">{seq.days_overdue} days overdue</span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {seq.client_email ?? '—'} {seq.client_phone ? `· ${seq.client_phone}` : ''}
                        </p>
                        {/* Stage Progress */}
                        <StageProgressBar seq={seq} />
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <p className="text-base font-bold text-red-600">{fmt(seq.amount_due)}</p>
                      <p className="text-[10px] text-muted-foreground text-right max-w-[160px]">{nextAction}</p>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => { setExpandedId(isExpanded ? null : seq.id); setNoteText(seq.notes ?? ''); }}
                          className="text-xs px-2.5 py-1.5 rounded-lg border border-border bg-secondary/40 hover:bg-secondary text-muted-foreground hover:text-foreground transition-all"
                        >
                          {isExpanded ? 'Collapse' : 'Details'}
                        </button>
                        {seq.portal_suspended && (
                          <button
                            onClick={() => handleUnsuspend(seq)}
                            disabled={actionLoading === seq.id + '_unsuspend'}
                            className="text-xs px-2.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all disabled:opacity-50"
                          >
                            {actionLoading === seq.id + '_unsuspend' ? '…' : 'Restore Portal'}
                          </button>
                        )}
                        <button
                          onClick={() => handleResolve(seq.id)}
                          disabled={actionLoading === seq.id + '_resolve'}
                          className="text-xs px-2.5 py-1.5 rounded-lg border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 transition-all disabled:opacity-50"
                        >
                          {actionLoading === seq.id + '_resolve' ? '…' : '✓ Paid'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-border bg-secondary/20 p-4 space-y-4">
                    {/* Stage Checklist */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Sequence History</p>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                        {[
                          { label: '7-Day Email', done: seq.email_sent_7d },
                          { label: '7-Day SMS', done: seq.sms_sent_7d },
                          { label: '14-Day Email', done: seq.email_sent_14d },
                          { label: '14-Day SMS', done: seq.sms_sent_14d },
                          { label: '30-Day Email', done: seq.email_sent_30d },
                          { label: '30-Day SMS', done: seq.sms_sent_30d },
                          { label: 'Final Notice', done: seq.final_notice_sent },
                          { label: 'Portal Suspended', done: seq.portal_suspended },
                        ].map((item) => (
                          <div key={item.label} className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border ${item.done ? 'bg-green-50 border-green-200 text-green-700' : 'bg-card border-border text-muted-foreground'}`}>
                            <span>{item.done ? '✓' : '○'}</span>
                            <span>{item.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Timestamps */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-muted-foreground">Sequence started:</span>
                        <span className="ml-1 text-foreground font-medium">{fmtDate(seq.created_at)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Last action:</span>
                        <span className="ml-1 text-foreground font-medium">{fmtDate(seq.last_action_at)}</span>
                      </div>
                      {seq.final_notice_sent_at && (
                        <div>
                          <span className="text-muted-foreground">Final notice sent:</span>
                          <span className="ml-1 text-foreground font-medium">{fmtDate(seq.final_notice_sent_at)}</span>
                        </div>
                      )}
                      {seq.portal_suspended_at && (
                        <div>
                          <span className="text-muted-foreground">Portal suspended:</span>
                          <span className="ml-1 text-red-600 font-medium">{fmtDate(seq.portal_suspended_at)}</span>
                        </div>
                      )}
                    </div>

                    {/* Notes */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Admin Notes</p>
                      {seq.notes && (
                        <p className="text-xs text-foreground bg-card border border-border rounded-lg px-3 py-2 mb-2">{seq.notes}</p>
                      )}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          placeholder="Add a note about this account…"
                          className="flex-1 text-xs bg-card border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <button
                          onClick={() => handleSaveNote(seq.id)}
                          disabled={savingNote || !noteText.trim()}
                          className="text-xs px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-all disabled:opacity-50"
                        >
                          {savingNote ? '…' : 'Save'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
