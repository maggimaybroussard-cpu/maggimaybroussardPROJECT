'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { billingStore, BillingEntry, lsGet, lsSet } from '@/lib/localPersistence';

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
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

function generateId(): string {
  return `billing_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function BillingTimerWidget() {
  const [running, setRunning] = useState<BillingEntry | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [description, setDescription] = useState('');
  const [clientName, setClientName] = useState('');
  const [rate, setRate] = useState<number>(() => lsGet<number>('billing_default_rate', 250));
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Load running entry on mount
  useEffect(() => {
    const stored = billingStore.get();
    const runningEntry = stored.find(e => e.isRunning);
    if (runningEntry) {
      setRunning(runningEntry);
      const startMs = new Date(runningEntry.startTime).getTime();
      setElapsed(Math.floor((Date.now() - startMs) / 1000));
      setDescription(runningEntry.description);
      setClientName(runningEntry.clientName);
      setRate(runningEntry.rate);
    }
  }, []);

  // Tick
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        const startMs = new Date(running.startTime).getTime();
        setElapsed(Math.floor((Date.now() - startMs) / 1000));
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  // Close panel on outside click
  useEffect(() => {
    if (!expanded) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [expanded]);

  const handleStart = useCallback(() => {
    if (!description.trim() || !clientName.trim()) return;
    const entry: BillingEntry = {
      id: generateId(),
      startTime: new Date().toISOString(),
      duration: 0,
      description: description.trim(),
      clientName: clientName.trim(),
      caseRef: '',
      rate,
      isRunning: true,
    };
    billingStore.add(entry);
    setRunning(entry);
    setElapsed(0);
    setExpanded(false);
  }, [description, clientName, rate]);

  const handleStop = useCallback(() => {
    if (!running) return;
    const endTime = new Date().toISOString();
    billingStore.update(running.id, { isRunning: false, endTime, duration: elapsed });
    setRunning(null);
    setElapsed(0);
    setExpanded(false);
  }, [running, elapsed]);

  const isRunning = !!running;

  return (
    <div className="relative" ref={panelRef}>
      {/* Trigger button */}
      <button
        onClick={() => setExpanded(v => !v)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-semibold transition-all ${
          isRunning
            ? 'border-green-400 bg-green-50 text-green-700 hover:bg-green-100' :'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
        }`}
        title="Billing Timer"
      >
        {isRunning && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />}
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        <span className={`font-mono ${isRunning ? 'text-green-700' : ''}`}>
          {isRunning ? formatDuration(elapsed) : 'Timer'}
        </span>
        {isRunning && (
          <span className="hidden sm:inline text-green-600 font-semibold">{formatMoney(elapsed, running!.rate)}</span>
        )}
      </button>

      {/* Dropdown panel */}
      {expanded && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-card border border-border rounded-2xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-border bg-secondary/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              <span className="text-xs font-semibold text-foreground">Billing Timer</span>
            </div>
            <button onClick={() => setExpanded(false)} className="text-muted-foreground hover:text-foreground transition-colors">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div className="p-4 space-y-3">
            {/* Clock display */}
            <div className={`rounded-xl p-3 text-center border transition-all ${isRunning ? 'border-green-300 bg-green-50' : 'border-border bg-secondary/30'}`}>
              <div className={`text-3xl font-mono font-bold tracking-wider ${isRunning ? 'text-green-700' : 'text-foreground'}`}>
                {formatDuration(isRunning ? elapsed : 0)}
              </div>
              {isRunning && (
                <div className="flex items-center justify-center gap-1.5 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[11px] text-green-700 font-semibold">{formatMoney(elapsed, running!.rate)} earned</span>
                </div>
              )}
              {isRunning && (
                <p className="text-[10px] text-green-600 mt-0.5 truncate">{running!.description} · {running!.clientName}</p>
              )}
            </div>

            {/* Form (only when not running) */}
            {!isRunning && (
              <div className="space-y-2">
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Description *</label>
                  <input
                    type="text"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="e.g. Contract review, Client call"
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Client *</label>
                    <input
                      type="text"
                      value={clientName}
                      onChange={e => setClientName(e.target.value)}
                      placeholder="Client name"
                      className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Rate ($/hr)</label>
                    <input
                      type="number"
                      value={rate}
                      onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) { setRate(v); lsSet('billing_default_rate', v); } }}
                      className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Action button */}
            {isRunning ? (
              <button
                onClick={handleStop}
                className="w-full py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-colors flex items-center justify-center gap-2"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="1"/>
                </svg>
                Stop & Log Time
              </button>
            ) : (
              <button
                onClick={handleStart}
                disabled={!description.trim() || !clientName.trim()}
                className="w-full py-2.5 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-colors flex items-center justify-center gap-2"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                Start Billing Timer
              </button>
            )}

            {/* Link to full billing clock */}
            <p className="text-center text-[10px] text-muted-foreground">
              Full history in{' '}
              <button
                onClick={() => { setExpanded(false); }}
                className="text-primary hover:underline font-medium"
              >
                Billing Clock tab
              </button>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
