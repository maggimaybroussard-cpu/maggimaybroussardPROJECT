'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { billingStore, caseFoldersStore, audioStore, pinnedFilesStore } from '@/lib/localPersistence';
import TimeManagementWidget from '@/components/TimeManagementWidget';
import DocumentStorageWidget from '@/components/DocumentStorageWidget';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DashboardKPIs {
  openCases: number;
  pendingInvoices: number;
  totalBilledToday: number;
  totalEarnedToday: number;
  pinnedFiles: number;
  audioRecordings: number;
  caseFolders: number;
  runningClock: boolean;
}

interface RecentActivity {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  time: string;
  color: string;
}

// ── Simple in-memory cache for Supabase KPI queries (60s TTL) ────────────────
interface KPICache {
  openCases: number;
  pendingInvoices: number;
  cachedAt: number;
}
let kpiCache: KPICache | null = null;
const KPI_CACHE_TTL_MS = 60_000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LexiDashboard() {
  const [kpis, setKpis] = useState<DashboardKPIs>({
    openCases: 0,
    pendingInvoices: 0,
    totalBilledToday: 0,
    totalEarnedToday: 0,
    pinnedFiles: 0,
    audioRecordings: 0,
    caseFolders: 0,
    runningClock: false,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState('');

  // Clock
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    try {
      const now = Date.now();
      let openCases = 0;
      let pendingInvoices = 0;

      // Use cache if fresh (60s TTL) — avoids Supabase read on every Lexi open
      if (kpiCache && now - kpiCache.cachedAt < KPI_CACHE_TTL_MS) {
        openCases = kpiCache.openCases;
        pendingInvoices = kpiCache.pendingInvoices;
      } else {
        const supabase = createClient();
        // Parallel Supabase queries
        const [casesRes, invoicesRes] = await Promise.all([
          supabase.from('contact_inquiries').select('id', { count: 'exact', head: true }).eq('status', 'active'),
          supabase.from('client_invoices').select('id, amount', { count: 'exact' }).eq('status', 'pending'),
        ]);
        openCases = casesRes.count ?? 0;
        pendingInvoices = invoicesRes.count ?? 0;
        kpiCache = { openCases, pendingInvoices, cachedAt: now };
      }

      // Local data (no network cost)
      const billingEntries = billingStore.get();
      const today = new Date().toDateString();
      const todayEntries = billingEntries.filter(e => !e.isRunning && new Date(e.startTime).toDateString() === today);
      const totalBilledToday = todayEntries.reduce((sum, e) => sum + e.duration, 0);
      const totalEarnedToday = todayEntries.reduce((sum, e) => sum + (e.duration / 3600) * e.rate, 0);
      const runningClock = billingEntries.some(e => e.isRunning);

      setKpis({
        openCases,
        pendingInvoices,
        totalBilledToday,
        totalEarnedToday,
        pinnedFiles: pinnedFilesStore.get().length,
        audioRecordings: audioStore.getMeta().length,
        caseFolders: caseFoldersStore.get().length,
        runningClock,
      });

      // Build recent activity from local stores
      const activity: RecentActivity[] = [];

      // Recent billing entries
      billingEntries.filter(e => !e.isRunning).slice(0, 3).forEach(e => {
        activity.push({
          id: `billing_${e.id}`,
          icon: '⏱️',
          title: e.description,
          subtitle: `${e.clientName} · ${formatDuration(e.duration)} · ${formatCurrency((e.duration / 3600) * e.rate)}`,
          time: new Date(e.startTime).toLocaleDateString(),
          color: 'text-green-600',
        });
      });

      // Recent folders
      caseFoldersStore.get().slice(0, 2).forEach(f => {
        activity.push({
          id: `folder_${f.id}`,
          icon: '📁',
          title: f.name,
          subtitle: `${f.clientName}${f.caseRef ? ` · ${f.caseRef}` : ''}`,
          time: new Date(f.createdAt).toLocaleDateString(),
          color: 'text-blue-600',
        });
      });

      // Recent recordings
      audioStore.getMeta().slice(0, 2).forEach(r => {
        activity.push({
          id: `audio_${r.id}`,
          icon: '🎙️',
          title: r.name,
          subtitle: `${r.clientName ?? 'No client'}${r.caseRef ? ` · ${r.caseRef}` : ''}`,
          time: new Date(r.createdAt).toLocaleDateString(),
          color: 'text-purple-600',
        });
      });

      // Sort by time desc
      activity.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      setRecentActivity(activity.slice(0, 6));

    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const KPI_CARDS = [
    {
      label: 'Open Cases',
      value: kpis.openCases,
      icon: '⚖️',
      color: 'bg-blue-50 border-blue-200',
      valueColor: 'text-blue-700',
    },
    {
      label: 'Pending Invoices',
      value: kpis.pendingInvoices,
      icon: '📋',
      color: 'bg-amber-50 border-amber-200',
      valueColor: 'text-amber-700',
    },
    {
      label: "Today\'s Billed",
      value: formatDuration(kpis.totalBilledToday),
      icon: '⏱️',
      color: kpis.runningClock ? 'bg-green-50 border-green-300' : 'bg-green-50 border-green-200',
      valueColor: 'text-green-700',
      badge: kpis.runningClock ? '● Running' : undefined,
    },
    {
      label: "Today\'s Earned",
      value: formatCurrency(kpis.totalEarnedToday),
      icon: '💰',
      color: 'bg-emerald-50 border-emerald-200',
      valueColor: 'text-emerald-700',
    },
    {
      label: 'Case Folders',
      value: kpis.caseFolders,
      icon: '📁',
      color: 'bg-indigo-50 border-indigo-200',
      valueColor: 'text-indigo-700',
    },
    {
      label: 'Pinned Files',
      value: kpis.pinnedFiles,
      icon: '📌',
      color: 'bg-amber-50 border-amber-200',
      valueColor: 'text-amber-700',
    },
    {
      label: 'Recordings',
      value: kpis.audioRecordings,
      icon: '🎙️',
      color: 'bg-purple-50 border-purple-200',
      valueColor: 'text-purple-700',
    },
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-secondary/50 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">🚀</span>
            <div>
              <p className="text-sm font-semibold text-foreground">Lexi Dashboard</p>
              <p className="text-[10px] text-muted-foreground">Your practice cockpit</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-mono font-bold text-foreground">{currentTime}</p>
            <p className="text-[10px] text-muted-foreground">{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
          </div>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {/* KPI Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-secondary animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {KPI_CARDS.map(card => (
              <div key={card.label} className={`p-3 rounded-xl border ${card.color} relative`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] text-muted-foreground font-medium">{card.label}</p>
                    <p className={`text-lg font-bold mt-0.5 ${card.valueColor}`}>{card.value}</p>
                  </div>
                  <span className="text-base">{card.icon}</span>
                </div>
                {card.badge && (
                  <div className="flex items-center gap-1 mt-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[9px] text-green-700 font-semibold">{card.badge}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Running clock banner */}
        {kpis.runningClock && (() => {
          const running = billingStore.getRunning();
          if (!running) return null;
          const elapsed = Math.floor((Date.now() - new Date(running.startTime).getTime()) / 1000);
          const h = Math.floor(elapsed / 3600);
          const m = Math.floor((elapsed % 3600) / 60);
          const s = elapsed % 60;
          return (
            <div className="bg-green-50 border border-green-300 rounded-xl p-3 flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-green-800 truncate">{running.description}</p>
                <p className="text-[10px] text-green-700">{running.clientName} · ${running.rate}/hr</p>
              </div>
              <p className="text-sm font-mono font-bold text-green-700 shrink-0">
                {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
              </p>
            </div>
          );
        })()}

        {/* Quick actions */}
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Quick Actions</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: '⏱️', label: 'Start Clock', tab: 'billing' },
              { icon: '🎙️', label: 'Record', tab: 'audio' },
              { icon: '🔍', label: 'Search', tab: 'search' },
              { icon: '📁', label: 'Folders', tab: 'folders' },
              { icon: '📄', label: 'Draft Doc', tab: 'docs' },
              { icon: '✉️', label: 'Email', tab: 'email' },
            ].map(action => (
              <button
                key={action.label}
                className="flex flex-col items-center gap-1 p-2.5 rounded-xl border border-border bg-background hover:border-primary/40 hover:bg-primary/5 transition-all"
              >
                <span className="text-lg">{action.icon}</span>
                <span className="text-[9px] font-semibold text-muted-foreground">{action.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Time Management — Lexi integrated */}
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Time Management</p>
          <TimeManagementWidget lexiMode={true} className="max-h-72" />
        </div>

        {/* Document Storage — Lexi integrated */}
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Document Storage</p>
          <DocumentStorageWidget lexiMode={true} className="max-h-72" />
        </div>

        {/* Recent activity */}
        {recentActivity.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Recent Activity</p>
            <div className="flex flex-col gap-1.5">
              {recentActivity.map(item => (
                <div key={item.id} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors">
                  <span className="text-sm shrink-0">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{item.title}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{item.subtitle}</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground shrink-0">{item.time}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Refresh */}
        <button
          onClick={loadDashboard}
          className="w-full py-2 border border-border rounded-xl text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex items-center justify-center gap-1.5"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          Refresh Dashboard
        </button>
      </div>
    </div>
  );
}
