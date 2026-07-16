'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { billingStore, BillingEntry, lsGet, lsSet } from '@/lib/localPersistence';
import toast from 'react-hot-toast';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatMoney(seconds: number, rate: number): string {
  const hours = seconds / 3600;
  const amount = hours * rate;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function generateId(): string {
  return `billing_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const DEFAULT_RATE = lsGet<number>('billing_default_rate', 250);

// ── Component ─────────────────────────────────────────────────────────────────

export default function LexiBillingClock() {
  const [entries, setEntries] = useState<BillingEntry[]>([]);
  const [running, setRunning] = useState<BillingEntry | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [form, setForm] = useState({
    description: '',
    clientName: '',
    caseRef: '',
    rate: String(DEFAULT_RATE),
  });
  const [defaultRate, setDefaultRate] = useState(DEFAULT_RATE);
  const [showRateEditor, setShowRateEditor] = useState(false);
  const [activeView, setActiveView] = useState<'clock' | 'history'>('clock');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = billingStore.get();
    setEntries(stored);
    const runningEntry = stored.find(e => e.isRunning);
    if (runningEntry) {
      setRunning(runningEntry);
      const startMs = new Date(runningEntry.startTime).getTime();
      const alreadyElapsed = Math.floor((Date.now() - startMs) / 1000);
      setElapsed(alreadyElapsed);
      setForm({
        description: runningEntry.description,
        clientName: runningEntry.clientName,
        caseRef: runningEntry.caseRef,
        rate: String(runningEntry.rate),
      });
    }
  }, []);

  // Tick timer
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        const startMs = new Date(running.startTime).getTime();
        setElapsed(Math.floor((Date.now() - startMs) / 1000));
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  const handleStart = useCallback(() => {
    if (!form.description.trim()) {
      toast.error('Please enter a description');
      return;
    }
    if (!form.clientName.trim()) {
      toast.error('Please enter a client name');
      return;
    }
    const rate = parseFloat(form.rate) || defaultRate;
    const entry: BillingEntry = {
      id: generateId(),
      startTime: new Date().toISOString(),
      duration: 0,
      description: form.description,
      clientName: form.clientName,
      caseRef: form.caseRef,
      rate,
      isRunning: true,
    };
    billingStore.add(entry);
    setRunning(entry);
    setElapsed(0);
    setEntries(billingStore.get());
    toast.success('Billing clock started');
  }, [form, defaultRate]);

  const handleStop = useCallback(() => {
    if (!running) return;
    const endTime = new Date().toISOString();
    const duration = elapsed;
    billingStore.update(running.id, { isRunning: false, endTime, duration });
    setRunning(null);
    setElapsed(0);
    setEntries(billingStore.get());
    const amount = formatMoney(duration, running.rate);
    toast.success(`Stopped — ${formatDuration(duration)} logged (${amount})`);
  }, [running, elapsed]);

  const handleDelete = (id: string) => {
    billingStore.remove(id);
    setEntries(billingStore.get());
    toast.success('Entry deleted');
  };

  const handleSaveRate = (newRate: number) => {
    setDefaultRate(newRate);
    lsSet('billing_default_rate', newRate);
    setShowRateEditor(false);
    toast.success(`Default rate set to $${newRate}/hr`);
  };

  const totalBilled = entries.filter(e => !e.isRunning).reduce((sum, e) => sum + e.duration, 0);
  const totalEarned = entries.filter(e => !e.isRunning).reduce((sum, e) => sum + (e.duration / 3600) * e.rate, 0);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-secondary/50 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">⏱️</span>
            <div>
              <p className="text-sm font-semibold text-foreground">Billing Clock</p>
              <p className="text-[10px] text-muted-foreground">Track time → turn it into money</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowRateEditor(true)}
              className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-border/50 transition-colors"
            >
              ${defaultRate}/hr
            </button>
            <div className="flex rounded-lg border border-border overflow-hidden">
              {(['clock', 'history'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setActiveView(v)}
                  className={`px-2.5 py-1 text-[10px] font-semibold capitalize transition-colors ${activeView === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Summary bar */}
        <div className="flex gap-4 mt-2">
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground">Total Time</p>
            <p className="text-xs font-bold text-foreground">{formatDuration(totalBilled)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground">Total Earned</p>
            <p className="text-xs font-bold text-green-600">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalEarned)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground">Sessions</p>
            <p className="text-xs font-bold text-foreground">{entries.filter(e => !e.isRunning).length}</p>
          </div>
        </div>
      </div>

      {/* Rate editor modal */}
      {showRateEditor && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-5 w-72 shadow-2xl">
            <p className="text-sm font-semibold text-foreground mb-3">Set Default Hourly Rate</p>
            <RateEditorForm
              current={defaultRate}
              onSave={handleSaveRate}
              onCancel={() => setShowRateEditor(false)}
            />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {activeView === 'clock' && (
          <div className="p-4 flex flex-col gap-4">
            {/* Big clock display */}
            <div className={`rounded-2xl p-5 text-center border-2 transition-all ${running ? 'border-green-400 bg-green-50' : 'border-border bg-secondary/30'}`}>
              <div className={`text-4xl font-mono font-bold tracking-wider mb-1 ${running ? 'text-green-700' : 'text-foreground'}`}>
                {formatDuration(running ? elapsed : 0)}
              </div>
              {running && (
                <div className="flex items-center justify-center gap-2 mt-1">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <p className="text-xs text-green-700 font-semibold">
                    Running — {formatMoney(elapsed, running.rate)} earned
                  </p>
                </div>
              )}
              {running && (
                <p className="text-[10px] text-green-600 mt-1 truncate">{running.description} · {running.clientName}</p>
              )}
            </div>

            {/* Form */}
            {!running && (
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Description *</label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="e.g. Contract review, Client call, Research"
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Client *</label>
                    <input
                      type="text"
                      value={form.clientName}
                      onChange={e => setForm(p => ({ ...p, clientName: e.target.value }))}
                      placeholder="Client name"
                      className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Matter</label>
                    <input
                      type="text"
                      value={form.caseRef}
                      onChange={e => setForm(p => ({ ...p, caseRef: e.target.value }))}
                      placeholder="Case ref"
                      className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Rate ($/hr)</label>
                  <input
                    type="number"
                    value={form.rate}
                    onChange={e => setForm(p => ({ ...p, rate: e.target.value }))}
                    placeholder={String(defaultRate)}
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
            )}

            {/* Start / Stop button */}
            <button
              onClick={running ? handleStop : handleStart}
              className={`w-full py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                running
                  ? 'bg-red-500 hover:bg-red-600 text-white' :'bg-primary hover:opacity-90 text-primary-foreground'
              }`}
            >
              {running ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                  Stop & Save
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  Start Clock
                </>
              )}
            </button>
          </div>
        )}

        {activeView === 'history' && (
          <div className="p-4 flex flex-col gap-2">
            {entries.filter(e => !e.isRunning).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-xs">
                <p className="text-2xl mb-2">⏱️</p>
                <p>No billing entries yet.</p>
                <p className="mt-1">Start the clock to track your time.</p>
              </div>
            ) : (
              entries.filter(e => !e.isRunning).map(entry => (
                <BillingEntryCard key={entry.id} entry={entry} onDelete={handleDelete} />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function RateEditorForm({ current, onSave, onCancel }: { current: number; onSave: (r: number) => void; onCancel: () => void }) {
  const [val, setVal] = useState(String(current));
  return (
    <div className="flex flex-col gap-3">
      <input
        type="number"
        value={val}
        onChange={e => setVal(e.target.value)}
        className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        placeholder="e.g. 250"
        autoFocus
      />
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2 border border-border rounded-xl text-xs font-semibold text-muted-foreground hover:bg-secondary transition-colors">Cancel</button>
        <button onClick={() => onSave(parseFloat(val) || current)} className="flex-1 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-semibold hover:opacity-90 transition-all">Save</button>
      </div>
    </div>
  );
}

function BillingEntryCard({ entry, onDelete }: { entry: BillingEntry; onDelete: (id: string) => void }) {
  const earned = (entry.duration / 3600) * entry.rate;
  return (
    <div className="p-3 rounded-xl border border-border bg-background hover:border-primary/30 transition-all">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-foreground truncate">{entry.description}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{entry.clientName}{entry.caseRef ? ` · ${entry.caseRef}` : ''}</p>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-[10px] font-mono font-semibold text-foreground bg-secondary px-1.5 py-0.5 rounded">{formatDuration(entry.duration)}</span>
            <span className="text-[10px] font-semibold text-green-600">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(earned)}</span>
            <span className="text-[10px] text-muted-foreground">${entry.rate}/hr</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <p className="text-[10px] text-muted-foreground">{new Date(entry.startTime).toLocaleDateString()}</p>
          <button
            onClick={() => onDelete(entry.id)}
            className="text-[10px] text-red-500 hover:text-red-700 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
