'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import dynamic from 'next/dynamic';

// ── Lazy-load the heavy sub-modules ──────────────────────────────────────────
const TimeEntryModule = dynamic(() => import('./TimeEntryModule'), { ssr: false });
const MatterInvoiceBuilder = dynamic(() => import('./MatterInvoiceBuilder'), { ssr: false });
const ContractTemplatesDashboard = dynamic(() => import('./ContractTemplatesDashboard'), { ssr: false });
const DocumentManagementDashboard = dynamic(() => import('./DocumentManagementDashboard'), { ssr: false });
const TimesheetToInvoiceConverter = dynamic(() => import('./TimesheetToInvoiceConverter'), { ssr: false });

// ─── Types ────────────────────────────────────────────────────────────────────

interface CaseOption {
  id: string;
  name: string;
  email: string;
  service: string;
  retainer_subscription_id: string | null;
}

interface TimerEntry {
  caseId: string;
  caseName: string;
  workType: string;
  description: string;
  startedAt: number; // Date.now()
  elapsed: number;   // seconds accumulated before last pause
  running: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function fmtTimer(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function secondsToHours(s: number): number {
  return Math.round((s / 3600) * 4) / 4; // round to nearest 0.25h
}

const WORK_TYPES = [
  { value: 'research', label: 'Research', icon: '🔍' },
  { value: 'drafting', label: 'Drafting', icon: '✍️' },
  { value: 'calls', label: 'Client Call', icon: '📞' },
  { value: 'review', label: 'Review', icon: '📋' },
  { value: 'filing', label: 'Court Filing', icon: '⚖️' },
  { value: 'negotiation', label: 'Negotiation', icon: '🤝' },
  { value: 'other', label: 'Other', icon: '📌' },
];

// ─── Live Billing Timer ───────────────────────────────────────────────────────

interface TimerPanelProps {
  cases: CaseOption[];
  onLogEntry: (entry: { caseId: string; hours: number; workType: string; description: string }) => Promise<void>;
}

function TimerPanel({ cases, onLogEntry }: TimerPanelProps) {
  const [timer, setTimer] = useState<TimerEntry | null>(null);
  const [display, setDisplay] = useState(0); // seconds to show
  const [caseId, setCaseId] = useState('');
  const [workType, setWorkType] = useState('research');
  const [description, setDescription] = useState('');
  const [hourlyRate, setHourlyRate] = useState(250);
  const [logging, setLogging] = useState(false);
  const [logSuccess, setLogSuccess] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tick every second when running
  useEffect(() => {
    if (timer?.running) {
      intervalRef.current = setInterval(() => {
        const elapsed = timer.elapsed + Math.floor((Date.now() - timer.startedAt) / 1000);
        setDisplay(elapsed);
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setDisplay(timer?.elapsed ?? 0);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [timer]);

  const handleStart = () => {
    if (!caseId) return;
    const selectedCase = cases.find(c => c.id === caseId);
    setTimer({
      caseId,
      caseName: selectedCase?.name ?? 'Unknown',
      workType,
      description,
      startedAt: Date.now(),
      elapsed: timer?.elapsed ?? 0,
      running: true,
    });
  };

  const handlePause = () => {
    if (!timer) return;
    const elapsed = timer.elapsed + Math.floor((Date.now() - timer.startedAt) / 1000);
    setTimer({ ...timer, elapsed, running: false });
    setDisplay(elapsed);
  };

  const handleReset = () => {
    setTimer(null);
    setDisplay(0);
    setLogSuccess(null);
  };

  const handleLog = async () => {
    if (!timer || display < 60) return;
    setLogging(true);
    try {
      const hours = secondsToHours(display);
      await onLogEntry({ caseId: timer.caseId, hours, workType: timer.workType, description: timer.description || description });
      setLogSuccess(`✅ Logged ${hours.toFixed(2)}h (${fmtTimer(display)}) for ${timer.caseName} — ${fmt(hours * hourlyRate)}`);
      handleReset();
    } catch {
      // error handled by parent
    } finally {
      setLogging(false);
    }
  };

  const hours = secondsToHours(display);
  const billableAmount = hours * hourlyRate;
  const isRunning = timer?.running ?? false;
  const hasTime = display > 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Timer display */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-8 text-center">
        <div className={`font-mono text-6xl font-bold tracking-tight mb-2 transition-colors ${isRunning ? 'text-emerald-400' : 'text-white'}`}>
          {fmtTimer(display)}
        </div>
        <div className="text-slate-400 text-sm">
          {isRunning ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Recording — {timer?.caseName}
            </span>
          ) : hasTime ? (
            <span className="text-amber-400">Paused · {hours.toFixed(2)}h · {fmt(billableAmount)}</span>
          ) : (
            <span>Select a case and start the timer</span>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="p-6 space-y-4">
        {logSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700">
            {logSuccess}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Case / Client</label>
            <select
              value={caseId}
              onChange={e => setCaseId(e.target.value)}
              disabled={isRunning}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-60 bg-white"
            >
              <option value="">— Select a case —</option>
              {cases.map(c => (
                <option key={c.id} value={c.id}>{c.name} · {c.service}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Hourly Rate ($)</label>
            <input
              type="number"
              min={0}
              step={25}
              value={hourlyRate}
              onChange={e => setHourlyRate(Number(e.target.value))}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Work Type</label>
          <div className="flex flex-wrap gap-2">
            {WORK_TYPES.map(wt => (
              <button
                key={wt.value}
                type="button"
                onClick={() => setWorkType(wt.value)}
                disabled={isRunning}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-60 ${
                  workType === wt.value
                    ? 'bg-slate-800 text-white border-slate-800' :'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {wt.icon} {wt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Description (optional)</label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Brief note about this work session…"
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 pt-1">
          {!isRunning ? (
            <button
              onClick={handleStart}
              disabled={!caseId}
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-40 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              {hasTime ? 'Resume' : 'Start Timer'}
            </button>
          ) : (
            <button
              onClick={handlePause}
              className="flex-1 flex items-center justify-center gap-2 bg-amber-500 text-white py-3 rounded-xl text-sm font-semibold hover:bg-amber-600 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
              </svg>
              Pause
            </button>
          )}
          {hasTime && !isRunning && (
            <>
              <button
                onClick={handleLog}
                disabled={logging || display < 60}
                className="flex-1 flex items-center justify-center gap-2 bg-slate-800 text-white py-3 rounded-xl text-sm font-semibold hover:bg-slate-700 disabled:opacity-40 transition-colors"
              >
                {logging ? 'Logging…' : '🧾 Log & Bill'}
              </button>
              <button
                onClick={handleReset}
                className="px-4 py-3 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 text-sm transition-colors"
                title="Reset timer"
              >
                ✕
              </button>
            </>
          )}
        </div>

        {hasTime && (
          <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-3 gap-3 text-center text-sm">
            <div>
              <div className="font-bold text-slate-800">{fmtTimer(display)}</div>
              <div className="text-xs text-slate-400">Elapsed</div>
            </div>
            <div>
              <div className="font-bold text-slate-800">{hours.toFixed(2)}h</div>
              <div className="text-xs text-slate-400">Billable hrs</div>
            </div>
            <div>
              <div className="font-bold text-emerald-700">{fmt(billableAmount)}</div>
              <div className="text-xs text-slate-400">Billable amt</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── KPI Strip ────────────────────────────────────────────────────────────────

interface KPIData {
  totalHours: number;
  unbilledHours: number;
  unbilledAmount: number;
  openInvoices: number;
  openInvoiceAmount: number;
  contractCount: number;
  documentCount: number;
}

function KPIStrip({ kpi }: { kpi: KPIData }) {
  const items = [
    { label: 'Total Hours', value: `${kpi.totalHours.toFixed(1)}h`, icon: '⏱', color: 'bg-blue-50 border-blue-100 text-blue-700' },
    { label: 'Unbilled Hours', value: `${kpi.unbilledHours.toFixed(1)}h`, icon: '🔔', color: 'bg-amber-50 border-amber-100 text-amber-700' },
    { label: 'Unbilled Amount', value: fmt(kpi.unbilledAmount), icon: '💰', color: 'bg-emerald-50 border-emerald-100 text-emerald-700' },
    { label: 'Open Invoices', value: `${kpi.openInvoices}`, icon: '🧾', color: 'bg-violet-50 border-violet-100 text-violet-700' },
    { label: 'Contracts', value: `${kpi.contractCount}`, icon: '📄', color: 'bg-slate-50 border-slate-100 text-slate-700' },
    { label: 'Documents', value: `${kpi.documentCount}`, icon: '🗂', color: 'bg-teal-50 border-teal-100 text-teal-700' },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {items.map(item => (
        <div key={item.label} className={`rounded-xl border p-4 ${item.color}`}>
          <div className="text-xl mb-1">{item.icon}</div>
          <div className="text-lg font-bold">{item.value}</div>
          <div className="text-xs opacity-70 mt-0.5">{item.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Sub-tab nav ──────────────────────────────────────────────────────────────

type SubTab = 'timer' | 'time_log' | 'convert' | 'invoices' | 'contracts' | 'documents';

const SUB_TABS: { id: SubTab; label: string; icon: string; desc: string }[] = [
  { id: 'timer', label: 'Live Timer', icon: '⏱', desc: 'Start/stop billing clock' },
  { id: 'time_log', label: 'Time Log', icon: '📋', desc: 'Log & review entries' },
  { id: 'convert', label: 'Convert → Invoice', icon: '⚡', desc: 'One-click timesheet to invoice' },
  { id: 'invoices', label: 'Invoice Builder', icon: '🧾', desc: 'Build & send invoices' },
  { id: 'contracts', label: 'Contracts', icon: '📄', desc: 'Templates & generation' },
  { id: 'documents', label: 'Documents', icon: '🗂', desc: 'Organize & search files' },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PracticeManagementSuite() {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<SubTab>('timer');
  const [cases, setCases] = useState<CaseOption[]>([]);
  const [kpi, setKpi] = useState<KPIData>({
    totalHours: 0,
    unbilledHours: 0,
    unbilledAmount: 0,
    openInvoices: 0,
    openInvoiceAmount: 0,
    contractCount: 0,
    documentCount: 0,
  });
  const [kpiLoading, setKpiLoading] = useState(true);

  const loadKpi = useCallback(async () => {
    setKpiLoading(true);
    try {
      // Time logs
      const { data: logs } = await supabase
        .from('retainer_time_logs')
        .select('hours, billable, hourly_rate, invoice_id, billed_at');

      const totalHours = (logs ?? []).reduce((s, l) => s + (Number(l.hours) || 0), 0);
      const unbilledEntries = (logs ?? []).filter(l => l.billable && !l.billed_at && !l.invoice_id);
      const unbilledHours = unbilledEntries.reduce((s, l) => s + (Number(l.hours) || 0), 0);
      const unbilledAmount = unbilledEntries.reduce((s, l) => s + (Number(l.hours) || 0) * (Number(l.hourly_rate) || 250), 0);

      // Open invoices
      const { data: invoices } = await supabase
        .from('client_invoices')
        .select('amount, amount_paid, payment_status')
        .in('payment_status', ['unpaid', 'partial']);

      const openInvoices = (invoices ?? []).length;
      const openInvoiceAmount = (invoices ?? []).reduce((s, i) => s + (Number(i.amount) || 0) - (Number(i.amount_paid) || 0), 0);

      // Contracts
      const { count: contractCount } = await supabase
        .from('contracts_repository')
        .select('id', { count: 'exact', head: true });

      // Documents
      const { count: documentCount } = await supabase
        .from('case_documents')
        .select('id', { count: 'exact', head: true });

      setKpi({ totalHours, unbilledHours, unbilledAmount, openInvoices, openInvoiceAmount, contractCount: contractCount ?? 0, documentCount: documentCount ?? 0 });
    } catch {
      // silently fail KPI
    } finally {
      setKpiLoading(false);
    }
  }, [supabase]);

  const loadCases = useCallback(async () => {
    const { data: subs } = await supabase
      .from('retainer_subscriptions')
      .select('id, customer_name, customer_email, plan_name, inquiry_id')
      .in('status', ['active', 'trialing'])
      .order('customer_name');

    const { data: inquiries } = await supabase
      .from('contact_inquiries')
      .select('id, name, email, service')
      .in('status', ['active', 'in_progress', 'retainer', 'engaged'])
      .order('name');

    const caseMap = new Map<string, CaseOption>();
    (subs ?? []).forEach(s => {
      if (s.inquiry_id) {
        caseMap.set(s.inquiry_id, {
          id: s.inquiry_id,
          name: s.customer_name,
          email: s.customer_email,
          service: s.plan_name,
          retainer_subscription_id: s.id,
        });
      }
    });
    (inquiries ?? []).forEach(inq => {
      if (!caseMap.has(inq.id)) {
        caseMap.set(inq.id, { id: inq.id, name: inq.name, email: inq.email, service: inq.service, retainer_subscription_id: null });
      }
    });
    setCases([...caseMap.values()]);
  }, [supabase]);

  useEffect(() => {
    loadKpi();
    loadCases();
  }, [loadKpi, loadCases]);

  const handleTimerLog = async (entry: { caseId: string; hours: number; workType: string; description: string }) => {
    const selectedCase = cases.find(c => c.id === entry.caseId);
    if (!selectedCase?.retainer_subscription_id) {
      throw new Error('No active retainer subscription for this case.');
    }
    const { error } = await supabase.from('retainer_time_logs').insert({
      retainer_subscription_id: selectedCase.retainer_subscription_id,
      inquiry_id: entry.caseId,
      hours: entry.hours,
      work_type: entry.workType,
      task_category: entry.workType,
      description: entry.description || null,
      work_date: new Date().toISOString().split('T')[0],
      logged_by: 'Admin',
      hourly_rate: 250,
      billable: true,
    });
    if (error) throw error;
    await loadKpi();
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Practice Management</h2>
          <p className="text-sm text-slate-500 mt-0.5">Timed billing · Invoices · Contracts · Documents — all in one place</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Live billing suite
        </div>
      </div>

      {/* KPI Strip */}
      {!kpiLoading && <KPIStrip kpi={kpi} />}

      {/* Sub-tab nav */}
      <div className="flex gap-1 bg-slate-100 rounded-2xl p-1.5 overflow-x-auto">
        {SUB_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      <div>
        {activeTab === 'timer' && (
          <div className="max-w-2xl">
            <TimerPanel cases={cases} onLogEntry={handleTimerLog} />
          </div>
        )}

        {activeTab === 'time_log' && <TimeEntryModule />}

        {activeTab === 'convert' && <TimesheetToInvoiceConverter />}

        {activeTab === 'invoices' && <MatterInvoiceBuilder />}

        {activeTab === 'contracts' && <ContractTemplatesDashboard />}

        {activeTab === 'documents' && <DocumentManagementDashboard />}
      </div>
    </div>
  );
}
