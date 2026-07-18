'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { billingStore, caseFoldersStore, audioStore, pinnedFilesStore } from '@/lib/localPersistence';

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

interface SmartSuggestion {
  id: string;
  icon: string;
  title: string;
  detail: string;
  priority: 'high' | 'medium' | 'low';
  action: string;
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

// ── Smart Suggestions ─────────────────────────────────────────────────────────

const SMART_SUGGESTIONS: SmartSuggestion[] = [
  {
    id: 'follow-up',
    icon: '📞',
    title: 'Follow up with 3 pending leads',
    detail: 'Leads older than 48h with no response',
    priority: 'high',
    action: 'View Leads',
  },
  {
    id: 'invoice-overdue',
    icon: '💸',
    title: 'Send overdue invoice reminders',
    detail: '2 invoices past due date',
    priority: 'high',
    action: 'View Invoices',
  },
  {
    id: 'case-update',
    icon: '⚖️',
    title: 'Update case status for 4 matters',
    detail: 'No activity in 7+ days',
    priority: 'medium',
    action: 'View Cases',
  },
  {
    id: 'doc-review',
    icon: '📄',
    title: 'Review flagged documents',
    detail: '1 document awaiting your review',
    priority: 'medium',
    action: 'View Docs',
  },
  {
    id: 'calendar',
    icon: '📅',
    title: 'Confirm tomorrow\'s consultations',
    detail: '2 consultations scheduled',
    priority: 'low',
    action: 'View Calendar',
  },
];

const PRIORITY_COLORS: Record<SmartSuggestion['priority'], string> = {
  high: 'bg-red-50 border-red-200 text-red-700',
  medium: 'bg-amber-50 border-amber-200 text-amber-700',
  low: 'bg-blue-50 border-blue-200 text-blue-700',
};

// ── Case Checklist ────────────────────────────────────────────────────────────

interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
  category: string;
}

const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { id: 'c1', label: 'Intake form completed', done: false, category: 'Intake' },
  { id: 'c2', label: 'Conflict check run', done: false, category: 'Intake' },
  { id: 'c3', label: 'Engagement letter signed', done: false, category: 'Intake' },
  { id: 'c4', label: 'Retainer collected', done: false, category: 'Billing' },
  { id: 'c5', label: 'Case folder created', done: false, category: 'Admin' },
  { id: 'c6', label: 'Initial research completed', done: false, category: 'Research' },
  { id: 'c7', label: 'Client portal invite sent', done: false, category: 'Client' },
  { id: 'c8', label: 'Deadlines calendared', done: false, category: 'Admin' },
  { id: 'c9', label: 'Opposing counsel identified', done: false, category: 'Research' },
  { id: 'c10', label: 'Discovery plan drafted', done: false, category: 'Strategy' },
];

// ── Component ─────────────────────────────────────────────────────────────────

type DashboardView = 'overview' | 'suggestions' | 'checklist';

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
  const [activeView, setActiveView] = useState<DashboardView>('overview');
  const [checklist, setChecklist] = useState<ChecklistItem[]>(DEFAULT_CHECKLIST);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<string[]>([]);

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

      if (kpiCache && now - kpiCache.cachedAt < KPI_CACHE_TTL_MS) {
        openCases = kpiCache.openCases;
        pendingInvoices = kpiCache.pendingInvoices;
      } else {
        const supabase = createClient();
        const [casesRes, invoicesRes] = await Promise.all([
          supabase.from('contact_inquiries').select('id', { count: 'exact', head: true }).eq('status', 'active'),
          supabase.from('client_invoices').select('id, amount', { count: 'exact' }).eq('status', 'pending'),
        ]);
        openCases = casesRes.count ?? 0;
        pendingInvoices = invoicesRes.count ?? 0;
        kpiCache = { openCases, pendingInvoices, cachedAt: now };
      }

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

      const activity: RecentActivity[] = [];
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

  const toggleChecklist = (id: string) => {
    setChecklist(prev => prev.map(item => item.id === id ? { ...item, done: !item.done } : item));
  };

  const dismissSuggestion = (id: string) => {
    setDismissedSuggestions(prev => [...prev, id]);
  };

  const visibleSuggestions = SMART_SUGGESTIONS.filter(s => !dismissedSuggestions.includes(s.id));
  const checklistDone = checklist.filter(c => c.done).length;
  const checklistPct = Math.round((checklistDone / checklist.length) * 100);

  const KPI_CARDS = [
    { label: 'Open Cases', value: kpis.openCases, icon: '⚖️', color: 'bg-blue-50 border-blue-200', valueColor: 'text-blue-700' },
    { label: 'Pending Invoices', value: kpis.pendingInvoices, icon: '📋', color: 'bg-amber-50 border-amber-200', valueColor: 'text-amber-700' },
    { label: "Today\'s Billed", value: formatDuration(kpis.totalBilledToday), icon: '⏱️', color: kpis.runningClock ? 'bg-green-50 border-green-300' : 'bg-green-50 border-green-200', valueColor: 'text-green-700', badge: kpis.runningClock ? '● Running' : undefined },
    { label: "Today\'s Earned", value: formatCurrency(kpis.totalEarnedToday), icon: '💰', color: 'bg-emerald-50 border-emerald-200', valueColor: 'text-emerald-700' },
    { label: 'Case Folders', value: kpis.caseFolders, icon: '📁', color: 'bg-indigo-50 border-indigo-200', valueColor: 'text-indigo-700' },
    { label: 'Pinned Files', value: kpis.pinnedFiles, icon: '📌', color: 'bg-amber-50 border-amber-200', valueColor: 'text-amber-700' },
    { label: 'Recordings', value: kpis.audioRecordings, icon: '🎙️', color: 'bg-purple-50 border-purple-200', valueColor: 'text-purple-700' },
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

        {/* View switcher */}
        <div className="flex gap-1 mt-3 p-0.5 bg-background/60 rounded-lg">
          {([
            { id: 'overview', label: 'Overview', icon: '📊' },
            { id: 'suggestions', label: 'Suggestions', icon: '💡', badge: visibleSuggestions.filter(s => s.priority === 'high').length },
            { id: 'checklist', label: 'Checklist', icon: '✅', badge: checklistDone < checklist.length ? checklist.length - checklistDone : 0 },
          ] as { id: DashboardView; label: string; icon: string; badge?: number }[]).map(v => (
            <button
              key={v.id}
              onClick={() => setActiveView(v.id)}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[10px] font-semibold transition-all relative ${
                activeView === v.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>{v.icon}</span>
              <span className="hidden sm:inline">{v.label}</span>
              {v.badge && v.badge > 0 ? (
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center">
                  {v.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 flex flex-col gap-4">

        {/* ── Overview View ── */}
        {activeView === 'overview' && (
          <>
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

            {/* Checklist progress teaser */}
            <button
              onClick={() => setActiveView('checklist')}
              className="flex items-center gap-3 p-3 rounded-xl border border-border bg-secondary/30 hover:bg-secondary/60 transition-all text-left"
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0" style={{ background: '#355E3B' }}>
                {checklistPct}%
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground">Case Checklist</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 bg-border rounded-full h-1">
                    <div className="h-full rounded-full transition-all" style={{ width: `${checklistPct}%`, background: '#355E3B' }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">{checklistDone}/{checklist.length}</span>
                </div>
              </div>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground shrink-0"><polyline points="9 18 15 12 9 6"/></svg>
            </button>

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
          </>
        )}

        {/* ── Suggestions View ── */}
        {activeView === 'suggestions' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Smart Suggestions</p>
              <span className="text-[10px] text-muted-foreground">{visibleSuggestions.length} active</span>
            </div>
            {visibleSuggestions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <span className="text-3xl mb-2">🎉</span>
                <p className="text-sm font-semibold text-foreground">All caught up!</p>
                <p className="text-xs text-muted-foreground mt-1">No pending suggestions right now.</p>
              </div>
            ) : (
              visibleSuggestions.map(s => (
                <div key={s.id} className={`rounded-xl border p-3 ${PRIORITY_COLORS[s.priority]}`}>
                  <div className="flex items-start gap-2.5">
                    <span className="text-base shrink-0">{s.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground">{s.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{s.detail}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${PRIORITY_COLORS[s.priority]}`}>
                          {s.priority}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => dismissSuggestion(s.id)}
                      className="text-muted-foreground/50 hover:text-muted-foreground transition-colors shrink-0 p-0.5"
                      title="Dismiss"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                </div>
              ))
            )}

            {/* Practice health score */}
            <div className="mt-2 p-3 rounded-xl border border-border bg-secondary/30">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Practice Health Score</p>
              <div className="flex items-center gap-3">
                <div className="relative w-14 h-14 shrink-0">
                  <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--border)" strokeWidth="3" />
                    <circle
                      cx="18" cy="18" r="15.9" fill="none"
                      stroke="#355E3B" strokeWidth="3"
                      strokeDasharray={`${72} 100`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-foreground">72</span>
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-foreground">Good Standing</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">2 overdue items pulling score down</p>
                  <div className="flex flex-col gap-1 mt-2">
                    {[
                      { label: 'Case Activity', score: 85, color: 'bg-green-500' },
                      { label: 'Billing Health', score: 60, color: 'bg-amber-500' },
                      { label: 'Client Comms', score: 78, color: 'bg-blue-500' },
                    ].map(metric => (
                      <div key={metric.label} className="flex items-center gap-2">
                        <span className="text-[9px] text-muted-foreground w-20 shrink-0">{metric.label}</span>
                        <div className="flex-1 bg-border rounded-full h-1">
                          <div className={`h-full rounded-full ${metric.color}`} style={{ width: `${metric.score}%` }} />
                        </div>
                        <span className="text-[9px] font-semibold text-muted-foreground w-6 text-right">{metric.score}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Checklist View ── */}
        {activeView === 'checklist' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">New Matter Checklist</p>
              <span className="text-[10px] font-semibold text-foreground">{checklistDone}/{checklist.length} done</span>
            </div>

            {/* Progress bar */}
            <div className="p-3 rounded-xl border border-border bg-secondary/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-foreground">{checklistPct}% Complete</span>
                <button
                  onClick={() => setChecklist(DEFAULT_CHECKLIST)}
                  className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  Reset
                </button>
              </div>
              <div className="w-full bg-border rounded-full h-2">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${checklistPct}%`, background: '#355E3B' }}
                />
              </div>
            </div>

            {/* Grouped checklist */}
            {['Intake', 'Billing', 'Admin', 'Research', 'Client', 'Strategy'].map(cat => {
              const items = checklist.filter(c => c.category === cat);
              if (!items.length) return null;
              return (
                <div key={cat}>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">{cat}</p>
                  <div className="flex flex-col gap-1">
                    {items.map(item => (
                      <button
                        key={item.id}
                        onClick={() => toggleChecklist(item.id)}
                        className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all ${
                          item.done
                            ? 'border-green-200 bg-green-50/50' :'border-border bg-background hover:border-primary/30'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                            item.done ? 'border-transparent' : 'border-border'
                          }`}
                          style={item.done ? { background: '#355E3B', borderColor: '#355E3B' } : {}}
                        >
                          {item.done && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          )}
                        </div>
                        <span className={`text-xs ${item.done ? 'line-through text-muted-foreground' : 'text-foreground font-medium'}`}>
                          {item.label}
                        </span>
                      </button>
                    ))}
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
