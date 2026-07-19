'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';


interface Client {
  id: string;
  name: string;
  email: string;
  service: string;
  retainer_subscription_id: string | null;
}

interface UnbilledEntry {
  id: string;
  hours: number;
  description: string | null;
  work_date: string;
  task_category: string;
  hourly_rate: number | null;
  logged_by: string | null;
}

interface InvoiceDraft {
  clientId: string;
  clientName: string;
  clientEmail: string;
  entries: UnbilledEntry[];
  totalHours: number;
  totalAmount: number;
  hourlyRate: number;
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const BOOKING_URL = process.env.NEXT_PUBLIC_CALENDLY_URL || '/book-consultation';

export default function TimesheetToInvoiceConverter() {
  const supabase = createClient();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [unbilledEntries, setUnbilledEntries] = useState<UnbilledEntry[]>([]);
  const [draft, setDraft] = useState<InvoiceDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [converting, setConverting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [invoiceNotes, setInvoiceNotes] = useState('');
  const [overrideRate, setOverrideRate] = useState('');
  const [dueInDays, setDueInDays] = useState('30');
  const [allUnbilledSummary, setAllUnbilledSummary] = useState<{ clientId: string; clientName: string; hours: number; amount: number }[]>([]);

  // Load all clients with unbilled time
  const loadClients = useCallback(async () => {
    setLoading(true);
    try {
      // Get all unbilled time entries
      const { data: logs } = await supabase
        .from('retainer_time_logs')
        .select('inquiry_id, hours, hourly_rate')
        .eq('billable', true)
        .is('billed_at', null)
        .is('invoice_id', null);

      if (!logs || logs.length === 0) {
        setClients([]);
        setAllUnbilledSummary([]);
        setLoading(false);
        return;
      }

      // Group by inquiry_id
      const clientMap = new Map<string, { hours: number; amount: number }>();
      for (const log of logs) {
        if (!log.inquiry_id) continue;
        const existing = clientMap.get(log.inquiry_id) || { hours: 0, amount: 0 };
        const h = Number(log.hours) || 0;
        const r = Number(log.hourly_rate) || 250;
        clientMap.set(log.inquiry_id, { hours: existing.hours + h, amount: existing.amount + h * r });
      }

      const inquiryIds = [...clientMap.keys()];
      if (inquiryIds.length === 0) {
        setClients([]);
        setAllUnbilledSummary([]);
        setLoading(false);
        return;
      }

      // Fetch client details
      const { data: inquiries } = await supabase
        .from('contact_inquiries')
        .select('id, name, email, service')
        .in('id', inquiryIds);

      // Fetch retainer subscriptions
      const { data: subs } = await supabase
        .from('retainer_subscriptions')
        .select('id, inquiry_id')
        .in('inquiry_id', inquiryIds)
        .in('status', ['active', 'trialing']);

      const subMap = new Map<string, string>();
      (subs || []).forEach(s => { if (s.inquiry_id) subMap.set(s.inquiry_id, s.id); });

      const clientList: Client[] = (inquiries || []).map(inq => ({
        id: inq.id,
        name: inq.name,
        email: inq.email,
        service: inq.service,
        retainer_subscription_id: subMap.get(inq.id) || null,
      }));

      setClients(clientList);

      const summary = clientList.map(c => ({
        clientId: c.id,
        clientName: c.name,
        hours: clientMap.get(c.id)?.hours || 0,
        amount: clientMap.get(c.id)?.amount || 0,
      })).sort((a, b) => b.amount - a.amount);

      setAllUnbilledSummary(summary);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { loadClients(); }, [loadClients]);

  // Load unbilled entries for selected client
  const loadUnbilledEntries = useCallback(async (clientId: string) => {
    if (!clientId) return;
    setLoading(true);
    setError(null);
    setDraft(null);
    try {
      const { data: entries, error: err } = await supabase
        .from('retainer_time_logs')
        .select('id, hours, description, work_date, task_category, hourly_rate, logged_by')
        .eq('inquiry_id', clientId)
        .eq('billable', true)
        .is('billed_at', null)
        .is('invoice_id', null)
        .order('work_date', { ascending: false });

      if (err) throw err;

      const client = clients.find(c => c.id === clientId);
      if (!client) return;

      const typedEntries = (entries || []) as UnbilledEntry[];
      const avgRate = typedEntries.length > 0
        ? typedEntries.reduce((s, e) => s + (Number(e.hourly_rate) || 250), 0) / typedEntries.length
        : 250;

      const totalHours = typedEntries.reduce((s, e) => s + Number(e.hours), 0);
      const totalAmount = typedEntries.reduce((s, e) => s + Number(e.hours) * (Number(e.hourly_rate) || 250), 0);

      setUnbilledEntries(typedEntries);
      setOverrideRate(String(Math.round(avgRate)));
      setDraft({
        clientId,
        clientName: client.name,
        clientEmail: client.email,
        entries: typedEntries,
        totalHours,
        totalAmount,
        hourlyRate: avgRate,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load time entries');
    } finally {
      setLoading(false);
    }
  }, [clients, supabase]);

  useEffect(() => {
    if (selectedClientId) loadUnbilledEntries(selectedClientId);
    else { setDraft(null); setUnbilledEntries([]); }
  }, [selectedClientId, loadUnbilledEntries]);

  const effectiveRate = overrideRate ? Number(overrideRate) : (draft?.hourlyRate || 250);
  const effectiveTotal = draft ? draft.entries.reduce((s, e) => s + Number(e.hours) * effectiveRate, 0) : 0;

  const handleConvert = async () => {
    if (!draft || draft.entries.length === 0) return;
    setConverting(true);
    setError(null);
    setSuccess(null);

    try {
      const dueDate = new Date(Date.now() + Number(dueInDays) * 86400000).toISOString().split('T')[0];
      const invoiceNumber = `INV-${Date.now().toString().slice(-7)}`;

      const lineItems = draft.entries.map(e => ({
        description: e.description || `${e.task_category} — ${fmtDate(e.work_date)}`,
        hours: Number(e.hours),
        rate: effectiveRate,
        total: Number(e.hours) * effectiveRate,
        work_date: e.work_date,
        work_type: e.task_category,
      }));

      const bookingNote = `\n\n---\n📅 Ready to discuss this invoice or plan next steps? Book a call: ${BOOKING_URL}`;
      const fullNotes = (invoiceNotes.trim() || `Invoice for ${draft.totalHours.toFixed(2)} hours of legal services.`) + bookingNote;

      // Create invoice
      const { data: invoice, error: invErr } = await supabase
        .from('client_invoices')
        .insert({
          invoice_number: invoiceNumber,
          invoice_date: new Date().toISOString().split('T')[0],
          due_date: dueDate,
          amount: effectiveTotal,
          amount_paid: 0,
          currency: 'usd',
          payment_status: 'unpaid',
          status: 'draft',
          notes: fullNotes,
          line_items: lineItems,
        })
        .select()
        .single();

      if (invErr) throw invErr;

      // Mark time entries as billed
      const entryIds = draft.entries.map(e => e.id);
      await supabase
        .from('retainer_time_logs')
        .update({
          billed_at: new Date().toISOString(),
          invoice_id: invoice.id,
        })
        .in('id', entryIds);

      setSuccess(`✅ Invoice ${invoiceNumber} created for ${draft.clientName} — ${fmt(effectiveTotal)} (${draft.totalHours.toFixed(2)}h). ${draft.entries.length} time entries marked as billed.`);
      setSelectedClientId('');
      setDraft(null);
      setUnbilledEntries([]);
      setInvoiceNotes('');
      await loadClients();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create invoice');
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            ⚡ One-Click Timesheet → Invoice
          </h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Bundle all unbilled time entries for a client into a new invoice draft instantly.
          </p>
        </div>
        <div className="text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-right">
          <div className="font-semibold text-slate-600">{allUnbilledSummary.length} clients</div>
          <div>with unbilled time</div>
        </div>
      </div>

      {/* Paralegal Disclaimer */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <p className="text-amber-800 text-xs">
          <strong>⚖️ Billing Notice:</strong> All invoices generated here reflect paralegal services performed under attorney supervision. Ensure all time entries have been reviewed and approved before converting to invoice.
        </p>
      </div>

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700 flex items-start gap-2">
          <span className="shrink-0 mt-0.5">✅</span>
          <span>{success}</span>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-2">✕</button>
        </div>
      )}

      {/* Unbilled Summary Cards */}
      {allUnbilledSummary.length > 0 && !selectedClientId && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Clients with Unbilled Time</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {allUnbilledSummary.map(s => (
              <button
                key={s.clientId}
                onClick={() => setSelectedClientId(s.clientId)}
                className="text-left p-4 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/30 transition-all group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 text-sm truncate">{s.clientName}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{s.hours.toFixed(2)}h unbilled</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-emerald-700 text-sm">{fmt(s.amount)}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 group-hover:text-emerald-600 transition-colors">Convert →</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {allUnbilledSummary.length === 0 && !loading && (
        <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-200">
          <div className="text-4xl mb-3">🎉</div>
          <p className="font-semibold text-slate-700">All caught up!</p>
          <p className="text-sm text-slate-500 mt-1">No unbilled time entries found. All time has been invoiced.</p>
        </div>
      )}

      {/* Client Selector */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-widest text-slate-600 mb-2">
          Select Client to Invoice
        </label>
        <div className="flex gap-3">
          <select
            value={selectedClientId}
            onChange={e => setSelectedClientId(e.target.value)}
            className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white"
          >
            <option value="">— Choose a client —</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name} · {c.service}</option>
            ))}
          </select>
          {selectedClientId && (
            <button onClick={() => { setSelectedClientId(''); setDraft(null); }}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 text-sm transition-colors">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Draft Preview */}
      {draft && draft.entries.length > 0 && (
        <div className="rounded-2xl border border-slate-200 overflow-hidden">
          {/* Draft Header */}
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-5 text-white">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-300 mb-1">Invoice Draft</p>
                <h4 className="text-xl font-bold">{draft.clientName}</h4>
                <p className="text-slate-300 text-sm mt-0.5">{draft.clientEmail}</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-emerald-400">{fmt(effectiveTotal)}</p>
                <p className="text-slate-300 text-sm mt-0.5">{draft.totalHours.toFixed(2)}h total</p>
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Description</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Date</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Hours</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Rate</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {draft.entries.map((entry, i) => (
                  <tr key={entry.id || i} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-slate-700 max-w-[200px] truncate">
                      {entry.description || entry.task_category || 'Legal Services'}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{fmtDate(entry.work_date)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{Number(entry.hours).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-slate-500 text-xs">{fmt(effectiveRate)}/hr</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">{fmt(Number(entry.hours) * effectiveRate)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-emerald-50 border-t-2 border-emerald-200">
                  <td colSpan={4} className="px-4 py-3 text-right font-bold text-slate-700 text-sm uppercase tracking-widest">Total Due</td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-700 text-lg">{fmt(effectiveTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Invoice Options */}
          <div className="p-6 bg-white border-t border-slate-200 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-slate-600 mb-1.5">Override Hourly Rate ($)</label>
                <input
                  type="number"
                  min={0}
                  step={25}
                  value={overrideRate}
                  onChange={e => setOverrideRate(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  placeholder="250"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-slate-600 mb-1.5">Due In (Days)</label>
                <select
                  value={dueInDays}
                  onChange={e => setDueInDays(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white"
                >
                  <option value="7">7 days</option>
                  <option value="14">14 days</option>
                  <option value="30">30 days (standard)</option>
                  <option value="45">45 days</option>
                  <option value="60">60 days</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-slate-600 mb-1.5">Invoice Notes (optional)</label>
              <textarea
                value={invoiceNotes}
                onChange={e => setInvoiceNotes(e.target.value)}
                rows={2}
                placeholder="Additional notes for the client…"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 resize-none"
              />
            </div>

            {/* Booking CTA Preview */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-3">
              <span className="text-blue-500 text-lg">📅</span>
              <div className="flex-1 min-w-0">
                <p className="text-blue-800 text-xs font-semibold">Booking CTA auto-included</p>
                <p className="text-blue-600 text-xs mt-0.5 truncate">Invoice will include: "Book a call to discuss: {BOOKING_URL}"</p>
              </div>
            </div>

            {/* Convert Button */}
            <button
              onClick={handleConvert}
              disabled={converting || draft.entries.length === 0}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #355E3B 0%, #4a7c59 100%)' }}
            >
              {converting ? (
                <>
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  Creating Invoice…
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/>
                  </svg>
                  Convert {draft.entries.length} Time Entries → Invoice Draft ({fmt(effectiveTotal)})
                </>
              )}
            </button>

            <p className="text-xs text-slate-400 text-center">
              All {draft.entries.length} time entries will be marked as billed and linked to this invoice.
            </p>
          </div>
        </div>
      )}

      {draft && draft.entries.length === 0 && (
        <div className="text-center py-8 bg-slate-50 rounded-2xl border border-slate-200">
          <p className="text-slate-500 text-sm">No unbilled time entries found for this client.</p>
        </div>
      )}

      {loading && (
        <div className="text-center py-8">
          <div className="inline-flex items-center gap-2 text-slate-500 text-sm">
            <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            Loading time entries…
          </div>
        </div>
      )}
    </div>
  );
}
