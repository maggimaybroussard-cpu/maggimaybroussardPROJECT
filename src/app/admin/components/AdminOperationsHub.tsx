'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import ConflictOfInterestChecker from '@/components/ConflictOfInterestChecker';
import OverdueInvoiceSequenceDashboard from './OverdueInvoiceSequenceDashboard';
import ReferralTrackingDashboard from './ReferralTrackingDashboard';

// ── Types ─────────────────────────────────────────────────────────────────────

interface UnbilledEntry {
  id: string;
  hours: number;
  description: string | null;
  work_date: string;
  work_type: string;
  hourly_rate: number | null;
  billable: boolean;
}

interface ClientOption {
  id: string;
  name: string;
  email: string;
  service: string;
}

type AdminOpsTab = 'timesheet_invoice' | 'conflict_check' | 'overdue_sequence' | 'referrals';

const TABS: { id: AdminOpsTab; label: string; icon: string }[] = [
  { id: 'timesheet_invoice', label: 'Timesheet → Invoice', icon: '⏱️' },
  { id: 'conflict_check', label: 'Conflict Checker', icon: '🔍' },
  { id: 'overdue_sequence', label: 'Overdue Sequences', icon: '📬' },
  { id: 'referrals', label: 'Referral Tracking', icon: '👥' },
];

// ── Timesheet → Invoice Component ─────────────────────────────────────────────

function TimesheetToInvoice() {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [unbilledEntries, setUnbilledEntries] = useState<UnbilledEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [converting, setConverting] = useState(false);
  const [result, setResult] = useState<{ invoiceId: string; total: number; entries: number } | null>(null);
  const [error, setError] = useState('');
  const supabase = createClient();

  const loadClients = useCallback(async () => {
    const { data: inquiries } = await supabase
      .from('contact_inquiries')
      .select('id, name, email, service')
      .in('status', ['active', 'in_progress', 'retainer', 'engaged'])
      .order('name');
    setClients((inquiries ?? []).map((i) => ({ id: i.id, name: i.name, email: i.email, service: i.service })));
  }, [supabase]);

  useEffect(() => { loadClients(); }, [loadClients]);

  const loadUnbilledEntries = useCallback(async (clientId: string) => {
    if (!clientId) { setUnbilledEntries([]); return; }
    setLoadingEntries(true);
    setResult(null);
    setError('');

    // Check retainer_time_logs first
    const { data: retainerLogs } = await supabase
      .from('retainer_time_logs')
      .select('id, hours, description, work_date, work_type, hourly_rate, billable')
      .eq('inquiry_id', clientId)
      .eq('billable', true)
      .is('invoice_id', null)
      .order('work_date', { ascending: false });

    // Also check matter_time_entries
    const { data: matterEntries } = await supabase
      .from('matter_time_entries')
      .select('id, hours, description, work_date, task_category, hourly_rate, billable')
      .eq('inquiry_id', clientId)
      .eq('billable', true)
      .is('invoice_id', null)
      .order('work_date', { ascending: false });

    const combined: UnbilledEntry[] = [
      ...(retainerLogs ?? []).map((e) => ({ ...e, work_type: e.work_type ?? 'general' })),
      ...(matterEntries ?? []).map((e) => ({ ...e, work_type: e.task_category ?? 'general' })),
    ];

    setUnbilledEntries(combined);
    setLoadingEntries(false);
  }, [supabase]);

  useEffect(() => {
    if (selectedClientId) loadUnbilledEntries(selectedClientId);
  }, [selectedClientId, loadUnbilledEntries]);

  const totalAmount = unbilledEntries.reduce((sum, e) => sum + (e.hours * (e.hourly_rate ?? 250)), 0);
  const totalHours = unbilledEntries.reduce((sum, e) => sum + e.hours, 0);

  const convertToInvoice = async () => {
    if (!selectedClientId || unbilledEntries.length === 0) return;
    setConverting(true);
    setError('');

    const client = clients.find((c) => c.id === selectedClientId);
    if (!client) { setError('Client not found.'); setConverting(false); return; }

    try {
      // Create invoice draft
      const invoiceNumber = `INV-${Date.now().toString().slice(-8)}`;
      const { data: invoice, error: invErr } = await supabase
        .from('client_invoices')
        .insert({
          inquiry_id: selectedClientId,
          client_name: client.name,
          client_email: client.email,
          invoice_number: invoiceNumber,
          amount_due: totalAmount,
          status: 'draft',
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          line_items: unbilledEntries.map((e) => ({
            description: e.description ?? e.work_type,
            hours: e.hours,
            rate: e.hourly_rate ?? 250,
            amount: e.hours * (e.hourly_rate ?? 250),
            date: e.work_date,
          })),
          notes: `Generated from ${unbilledEntries.length} unbilled time entries`,
        })
        .select('id')
        .single();

      if (invErr) throw invErr;

      // Mark time entries as invoiced
      const entryIds = unbilledEntries.map((e) => e.id);
      await Promise.all([
        supabase.from('retainer_time_logs').update({ invoice_id: invoice.id }).in('id', entryIds),
        supabase.from('matter_time_entries').update({ invoice_id: invoice.id }).in('id', entryIds),
      ]);

      setResult({ invoiceId: invoice.id, total: totalAmount, entries: unbilledEntries.length });
      setUnbilledEntries([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invoice draft.');
    } finally {
      setConverting(false);
    }
  };

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-bold text-slate-900 mb-1">Timesheet → Invoice</h3>
        <p className="text-sm text-slate-500">One-click convert all unbilled time entries for a client into a new invoice draft</p>
      </div>

      {/* Client selector */}
      <div>
        <label className="block text-xs font-medium mb-1 text-slate-600">Select Client</label>
        <select
          value={selectedClientId}
          onChange={(e) => setSelectedClientId(e.target.value)}
          className="w-full sm:w-80 text-sm px-3 py-2.5 rounded-xl border outline-none"
          style={{ borderColor: '#D9D0C5', color: '#2C1F14' }}
        >
          <option value="">— Choose a client —</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name} — {c.service}</option>
          ))}
        </select>
      </div>

      {/* Unbilled entries */}
      {selectedClientId && (
        <>
          {loadingEntries ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#4A3728' }} />
              Loading unbilled entries…
            </div>
          ) : unbilledEntries.length === 0 ? (
            <div className="rounded-xl border p-6 text-center" style={{ borderColor: '#D9D0C5' }}>
              <p className="text-slate-400">No unbilled time entries found for this client.</p>
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Unbilled Entries', value: unbilledEntries.length },
                  { label: 'Total Hours', value: `${totalHours.toFixed(2)}h` },
                  { label: 'Invoice Total', value: fmt(totalAmount) },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border bg-white p-4 text-center" style={{ borderColor: '#D9D0C5' }}>
                    <p className="text-xl font-bold text-slate-900">{s.value}</p>
                    <p className="text-xs text-slate-500">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Entry list */}
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#D9D0C5' }}>
                <div className="bg-slate-50 px-4 py-2 grid grid-cols-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <span>Date</span>
                  <span>Description</span>
                  <span className="text-right">Hours</span>
                  <span className="text-right">Amount</span>
                </div>
                {unbilledEntries.map((entry) => (
                  <div key={entry.id} className="px-4 py-3 grid grid-cols-4 text-sm border-t" style={{ borderColor: '#E5E7EB' }}>
                    <span className="text-slate-500">{new Date(entry.work_date).toLocaleDateString()}</span>
                    <span className="text-slate-900 truncate">{entry.description ?? entry.work_type}</span>
                    <span className="text-right text-slate-700">{entry.hours}h</span>
                    <span className="text-right font-medium text-slate-900">{fmt(entry.hours * (entry.hourly_rate ?? 250))}</span>
                  </div>
                ))}
                <div className="px-4 py-3 grid grid-cols-4 text-sm font-bold border-t" style={{ borderColor: '#D9D0C5', background: '#F9F0EC' }}>
                  <span className="col-span-2 text-slate-700">Total</span>
                  <span className="text-right text-slate-700">{totalHours.toFixed(2)}h</span>
                  <span className="text-right" style={{ color: '#355E3B' }}>{fmt(totalAmount)}</span>
                </div>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                onClick={convertToInvoice}
                disabled={converting}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 hover:opacity-90"
                style={{ background: '#355E3B' }}
              >
                {converting ? (
                  <><span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />Creating Invoice Draft…</>
                ) : (
                  <>⚡ Convert to Invoice Draft ({fmt(totalAmount)})</>
                )}
              </button>
            </>
          )}
        </>
      )}

      {/* Success */}
      {result && (
        <div className="rounded-xl border p-5 bg-green-50 border-green-200">
          <p className="font-semibold text-green-800 mb-1">✅ Invoice Draft Created</p>
          <p className="text-sm text-green-700">
            {result.entries} time entries converted → Invoice total: {fmt(result.total)}
          </p>
          <p className="text-xs text-green-600 mt-1">Invoice ID: {result.invoiceId}</p>
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AdminOperationsHub() {
  const [activeTab, setActiveTab] = useState<AdminOpsTab>('timesheet_invoice');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Admin Operations Hub</h2>
        <p className="text-sm text-slate-500 mt-0.5">Timesheet conversion · Conflict checks · Overdue sequences · Referral tracking</p>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 bg-slate-100 rounded-2xl p-1.5 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'timesheet_invoice' && <TimesheetToInvoice />}
        {activeTab === 'conflict_check' && <ConflictOfInterestChecker />}
        {activeTab === 'overdue_sequence' && <OverdueInvoiceSequenceDashboard />}
        {activeTab === 'referrals' && <ReferralTrackingDashboard />}
      </div>
    </div>
  );
}
