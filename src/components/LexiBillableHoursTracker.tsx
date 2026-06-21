'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RetainerSubscription {
  id: string;
  customer_name: string;
  customer_email: string;
  plan_name: string;
  amount: number;
  status: string;
}

interface CaseInquiry {
  id: string;
  name: string;
  email: string;
  service: string;
}

interface TimeLogEntry {
  id: string;
  retainer_subscription_id: string;
  inquiry_id: string | null;
  hours: number;
  description: string | null;
  work_date: string;
  work_type: string | null;
  case_task: string | null;
  logged_by: string | null;
  billed_at: string | null;
  created_at: string;
  retainer_subscriptions?: { customer_name: string; plan_name: string } | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const WORK_CATEGORIES = [
  { value: 'research', label: 'Research', icon: '🔍', color: 'bg-blue-50 text-blue-700 border-blue-200', keywords: ['research', 'look up', 'find', 'investigate', 'review law', 'case law', 'statute', 'regulation'] },
  { value: 'drafting', label: 'Drafting', icon: '✍️', color: 'bg-violet-50 text-violet-700 border-violet-200', keywords: ['draft', 'write', 'prepare', 'document', 'contract', 'motion', 'brief', 'letter', 'agreement', 'pleading'] },
  { value: 'meetings', label: 'Meetings', icon: '🤝', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', keywords: ['meet', 'call', 'consult', 'conference', 'discuss', 'client', 'deposition', 'hearing', 'mediation'] },
  { value: 'review', label: 'Review', icon: '📋', color: 'bg-amber-50 text-amber-700 border-amber-200', keywords: ['review', 'read', 'analyze', 'examine', 'check', 'proofread', 'discovery'] },
  { value: 'filing', label: 'Court Filing', icon: '⚖️', color: 'bg-red-50 text-red-700 border-red-200', keywords: ['file', 'court', 'submit', 'clerk', 'docket', 'e-file', 'serve', 'summons'] },
  { value: 'other', label: 'Other', icon: '📌', color: 'bg-gray-100 text-gray-600 border-gray-200', keywords: [] },
];

function autoDetectCategory(description: string): string {
  const lower = description.toLowerCase();
  for (const cat of WORK_CATEGORIES) {
    if (cat.keywords.some(kw => lower.includes(kw))) {
      return cat.value;
    }
  }
  return 'other';
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function secondsToHours(seconds: number): number {
  return Math.round((seconds / 3600) * 100) / 100;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function LexiBillableHoursTracker() {
  const supabase = createClient();

  // Timer state
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Form state
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('other');
  const [autoDetected, setAutoDetected] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [manualHours, setManualHours] = useState('');
  const [useManual, setUseManual] = useState(false);

  // Data
  const [clients, setClients] = useState<RetainerSubscription[]>([]);
  const [cases, setCases] = useState<CaseInquiry[]>([]);
  const [recentLogs, setRecentLogs] = useState<TimeLogEntry[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);

  // ── Fetch clients and recent logs ─────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [subsRes, casesRes, logsRes] = await Promise.all([
        supabase
          .from('retainer_subscriptions')
          .select('id, customer_name, customer_email, plan_name, amount, status')
          .eq('status', 'active')
          .order('customer_name'),
        supabase
          .from('contact_inquiries')
          .select('id, name, email, service')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('retainer_time_logs')
          .select('id, retainer_subscription_id, inquiry_id, hours, description, work_date, work_type, case_task, logged_by, billed_at, created_at, retainer_subscriptions(customer_name, plan_name)')
          .eq('logged_by', 'Lexi')
          .order('created_at', { ascending: false })
          .limit(10),
      ]);

      if (subsRes.data) setClients(subsRes.data);
      if (casesRes.data) setCases(casesRes.data);
      if (logsRes.data) setRecentLogs(logsRes.data as TimeLogEntry[]);
    } catch {
      // silently handle
    } finally {
      setLoadingData(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Timer logic ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  const handleStart = () => {
    setStartTime(new Date());
    setElapsedSeconds(0);
    setIsRunning(true);
  };

  const handleStop = () => {
    setIsRunning(false);
  };

  const handleReset = () => {
    setIsRunning(false);
    setElapsedSeconds(0);
    setStartTime(null);
  };

  // ── Auto-detect category from description ─────────────────────────────────
  useEffect(() => {
    if (description.trim().length > 3) {
      const detected = autoDetectCategory(description);
      setSelectedCategory(detected);
      setAutoDetected(true);
    } else {
      setAutoDetected(false);
    }
  }, [description]);

  // ── Save log ──────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!selectedClientId) {
      toast.error('Please select a client');
      return;
    }
    if (!description.trim()) {
      toast.error('Please add a description');
      return;
    }

    const hoursToLog = useManual
      ? parseFloat(manualHours)
      : secondsToHours(elapsedSeconds);

    if (!hoursToLog || hoursToLog <= 0) {
      toast.error('No time to log — start the timer or enter hours manually');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('retainer_time_logs').insert({
        retainer_subscription_id: selectedClientId,
        inquiry_id: selectedCaseId || null,
        hours: hoursToLog,
        description: description.trim(),
        work_date: new Date().toISOString().slice(0, 10),
        work_type: selectedCategory,
        logged_by: 'Lexi',
        logged_at: new Date().toISOString(),
      });

      if (error) throw error;

      toast.success(`✅ ${hoursToLog.toFixed(2)}h logged for ${clients.find(c => c.id === selectedClientId)?.customer_name ?? 'client'}`);

      // Auto-queue invoice draft for admin approval
      try {
        const client = clients.find(c => c.id === selectedClientId);
        if (client) {
          const hourlyRate = 150; // default rate
          const subtotal = hoursToLog * hourlyRate;
          await supabase.from('lexi_invoice_drafts').insert({
            retainer_subscription_id: selectedClientId,
            inquiry_id: selectedCaseId || null,
            client_name: client.customer_name,
            client_email: client.customer_email,
            total_hours: hoursToLog,
            hourly_rate: hourlyRate,
            subtotal,
            line_items: [{
              description: description.trim(),
              hours: hoursToLog,
              rate: hourlyRate,
              total: subtotal,
              work_type: selectedCategory,
              work_date: new Date().toISOString().slice(0, 10),
            }],
            notes: `Auto-queued by Lexi from billable hours log`,
            draft_status: 'pending_approval',
          });
        }
      } catch {
        // Non-blocking — don't fail the save if draft queue fails
      }

      // Reset form
      setDescription('');
      setSelectedCategory('other');
      setAutoDetected(false);
      setSelectedCaseId('');
      setManualHours('');
      setElapsedSeconds(0);
      setStartTime(null);
      setIsRunning(false);
      setUseManual(false);

      // Refresh logs
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save time log');
    } finally {
      setSaving(false);
    }
  };

  const hoursToLog = useManual
    ? parseFloat(manualHours) || 0
    : secondsToHours(elapsedSeconds);

  const selectedCat = WORK_CATEGORIES.find(c => c.value === selectedCategory) ?? WORK_CATEGORIES[WORK_CATEGORIES.length - 1];

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-secondary/50 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-base">⏱️</span>
          <div>
            <p className="text-sm font-semibold text-foreground">Billable Hours</p>
            <p className="text-[10px] text-muted-foreground">Lexi · Syncs to Admin Dashboard</p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 flex flex-col gap-4">
        {/* ── Timer Display ── */}
        <div className="bg-primary/5 border border-primary/15 rounded-2xl p-4 text-center">
          <div className={`text-4xl font-mono font-bold tracking-tight mb-3 transition-colors ${isRunning ? 'text-primary' : 'text-foreground'}`}>
            {formatDuration(elapsedSeconds)}
          </div>

          {/* Timer controls */}
          <div className="flex items-center justify-center gap-2 mb-3">
            {!isRunning ? (
              <button
                onClick={handleStart}
                disabled={useManual}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-40"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Start Timer
              </button>
            ) : (
              <button
                onClick={handleStop}
                className="flex items-center gap-2 px-5 py-2.5 bg-red-500 text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-all"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                Stop
              </button>
            )}
            {elapsedSeconds > 0 && !isRunning && (
              <button
                onClick={handleReset}
                className="px-3 py-2.5 border border-border text-muted-foreground rounded-xl text-xs hover:bg-secondary transition-colors"
              >
                Reset
              </button>
            )}
          </div>

          {/* Manual hours toggle */}
          <button
            onClick={() => setUseManual(prev => !prev)}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
          >
            {useManual ? 'Use timer instead' : 'Enter hours manually'}
          </button>

          {useManual && (
            <div className="mt-3 flex items-center justify-center gap-2">
              <input
                type="number"
                min="0.1"
                max="24"
                step="0.25"
                value={manualHours}
                onChange={e => setManualHours(e.target.value)}
                placeholder="e.g. 1.5"
                className="w-28 px-3 py-2 bg-background border border-border rounded-lg text-sm text-center text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <span className="text-sm text-muted-foreground">hours</span>
            </div>
          )}

          {hoursToLog > 0 && (
            <p className="text-xs text-primary font-semibold mt-2">
              {hoursToLog.toFixed(2)} hours to log
            </p>
          )}
        </div>

        {/* ── Client / Case Selection ── */}
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Client *</label>
            {loadingData ? (
              <div className="h-9 bg-secondary rounded-lg animate-pulse" />
            ) : (
              <select
                value={selectedClientId}
                onChange={e => setSelectedClientId(e.target.value)}
                className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
              >
                <option value="">Select client…</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.customer_name} — {c.plan_name}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Case / Matter <span className="font-normal">(optional)</span></label>
            <select
              value={selectedCaseId}
              onChange={e => setSelectedCaseId(e.target.value)}
              className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
            >
              <option value="">No specific case</option>
              {cases.map(c => (
                <option key={c.id} value={c.id}>{c.name} — {c.service}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Description ── */}
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Work Description *</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="e.g. Drafted motion to compel discovery responses…"
            rows={3}
            className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-none"
          />
        </div>

        {/* ── Category ── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Category</label>
            {autoDetected && (
              <span className="text-[10px] text-primary font-medium flex items-center gap-1">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Auto-detected
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {WORK_CATEGORIES.map(cat => (
              <button
                key={cat.value}
                onClick={() => { setSelectedCategory(cat.value); setAutoDetected(false); }}
                className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border text-center transition-all ${selectedCategory === cat.value ? `${cat.color} ring-1 ring-current/30` : 'border-border bg-background text-muted-foreground hover:border-primary/30'}`}
              >
                <span className="text-base leading-none">{cat.icon}</span>
                <span className="text-[10px] font-medium leading-tight">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Save Button ── */}
        <button
          onClick={handleSave}
          disabled={saving || !selectedClientId || !description.trim() || hoursToLog <= 0}
          className="w-full py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              Log {hoursToLog > 0 ? `${hoursToLog.toFixed(2)}h` : 'Hours'} to Admin Dashboard
            </>
          )}
        </button>

        {/* ── Recent Logs ── */}
        {recentLogs.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Recent Logs by Lexi</p>
            <div className="flex flex-col gap-1.5">
              {recentLogs.slice(0, 5).map(log => {
                const cat = WORK_CATEGORIES.find(c => c.value === log.work_type) ?? WORK_CATEGORIES[WORK_CATEGORIES.length - 1];
                const clientName = (log.retainer_subscriptions as { customer_name: string } | null)?.customer_name ?? '—';
                return (
                  <div key={log.id} className="flex items-center gap-2.5 px-3 py-2.5 bg-secondary rounded-xl border border-border">
                    <span className="text-sm shrink-0">{cat.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{clientName}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{log.description ?? '—'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-foreground">{Number(log.hours).toFixed(2)}h</p>
                      <p className="text-[10px] text-muted-foreground">{fmtDate(log.work_date)}</p>
                    </div>
                    {log.billed_at && (
                      <span className="text-[10px] text-emerald-600 font-medium shrink-0">✓</span>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-2">
              View all in Admin → Billable Hours
            </p>
          </div>
        )}

        {loadingData && recentLogs.length === 0 && (
          <div className="flex flex-col gap-1.5">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-14 bg-secondary rounded-xl animate-pulse" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
