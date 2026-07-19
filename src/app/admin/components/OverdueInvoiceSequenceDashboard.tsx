'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface OverdueSequence {
  id: string;
  invoice_id: string;
  client_name: string | null;
  client_email: string | null;
  amount_due: number;
  due_date: string;
  days_overdue: number;
  tier: number;
  sms_sent_7d: boolean;
  email_sent_7d: boolean;
  sms_sent_14d: boolean;
  email_sent_14d: boolean;
  sms_sent_30d: boolean;
  email_sent_30d: boolean;
  resolved: boolean;
  last_action_at: string | null;
  created_at: string;
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function OverdueInvoiceSequenceDashboard() {
  const [sequences, setSequences] = useState<OverdueSequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [triggerResult, setTriggerResult] = useState<{ processed: number; results: { invoiceId: string; tier: number; smsSent: boolean; emailSent: boolean; skipped: boolean }[] } | null>(null);
  const [dryRun, setDryRun] = useState(false);
  const supabase = createClient();

  const loadSequences = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('overdue_invoice_sequences')
      .select('*')
      .eq('resolved', false)
      .order('days_overdue', { ascending: false })
      .limit(50);
    setSequences(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadSequences(); }, [loadSequences]);

  const triggerSequence = async () => {
    setTriggering(true);
    setTriggerResult(null);
    try {
      const res = await fetch('/api/admin/overdue-invoice-sequence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun }),
      });
      const data = await res.json();
      setTriggerResult(data);
      if (!dryRun) await loadSequences();
    } catch {
      // silent
    } finally {
      setTriggering(false);
    }
  };

  const markResolved = async (id: string) => {
    await supabase.from('overdue_invoice_sequences').update({ resolved: true, resolved_at: new Date().toISOString() }).eq('id', id);
    setSequences((prev) => prev.filter((s) => s.id !== id));
  };

  const tierLabel = (tier: number) => {
    switch (tier) {
      case 1: return { label: '7-Day', color: '#D97706', bg: '#FEF3C7' };
      case 2: return { label: '14-Day', color: '#EA580C', bg: '#FFF7ED' };
      case 3: return { label: '30-Day Final', color: '#DC2626', bg: '#FEF2F2' };
      default: return { label: 'Unknown', color: '#6B7280', bg: '#F3F4F6' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Overdue Invoice Sequences</h3>
          <p className="text-sm text-slate-500">Escalating SMS + email at 7, 14, and 30 days past due</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} className="rounded" />
            Dry run
          </label>
          <button
            onClick={triggerSequence}
            disabled={triggering}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
            style={{ background: '#4A3728' }}
          >
            {triggering ? (
              <><span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />Running…</>
            ) : (
              <>⚡ Run Sequence Now</>
            )}
          </button>
        </div>
      </div>

      {/* Trigger result */}
      {triggerResult && (
        <div className="rounded-xl border p-4 bg-green-50 border-green-200">
          <p className="text-sm font-semibold text-green-800 mb-2">
            {dryRun ? '🔍 Dry Run Complete' : '✅ Sequence Triggered'} — {triggerResult.processed} invoice{triggerResult.processed !== 1 ? 's' : ''} processed
          </p>
          <div className="space-y-1">
            {triggerResult.results?.map((r, i) => (
              <p key={i} className="text-xs text-green-700">
                Invoice {r.invoiceId.slice(0, 8)}… — Tier {r.tier} — SMS: {r.smsSent ? '✓' : '–'} Email: {r.emailSent ? '✓' : '–'} {r.skipped ? '(already sent)' : ''}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Sequences table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <span className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#4A3728' }} />
        </div>
      ) : sequences.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <p className="text-4xl mb-3">✅</p>
          <p className="font-medium">No active overdue sequences</p>
          <p className="text-sm">All invoices are current or resolved</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sequences.map((seq) => {
            const tier = tierLabel(seq.tier);
            return (
              <div key={seq.id} className="rounded-xl border bg-white p-4" style={{ borderColor: '#E5E7EB' }}>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-slate-900 truncate">{seq.client_name ?? 'Unknown Client'}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: tier.bg, color: tier.color }}>
                        {tier.label}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500">{seq.client_email ?? 'No email'}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                      <span>Due: {new Date(seq.due_date).toLocaleDateString()}</span>
                      <span className="font-semibold" style={{ color: tier.color }}>{seq.days_overdue} days overdue</span>
                      <span className="font-bold text-slate-700">{fmt(seq.amount_due)}</span>
                    </div>
                  </div>
                  {/* Sent indicators */}
                  <div className="flex items-center gap-2 text-xs">
                    {[
                      { label: '7d SMS', sent: seq.sms_sent_7d },
                      { label: '7d Email', sent: seq.email_sent_7d },
                      { label: '14d SMS', sent: seq.sms_sent_14d },
                      { label: '14d Email', sent: seq.email_sent_14d },
                      { label: '30d SMS', sent: seq.sms_sent_30d },
                      { label: '30d Email', sent: seq.email_sent_30d },
                    ].map((item) => (
                      <span
                        key={item.label}
                        className="px-1.5 py-0.5 rounded text-xs"
                        style={{
                          background: item.sent ? '#D1FAE5' : '#F3F4F6',
                          color: item.sent ? '#065F46' : '#9CA3AF',
                        }}
                      >
                        {item.sent ? '✓' : '○'} {item.label}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={() => markResolved(seq.id)}
                    className="text-xs px-3 py-1.5 rounded-lg border transition-all hover:bg-green-50"
                    style={{ borderColor: '#D9D0C5', color: '#355E3B' }}
                  >
                    Mark Resolved
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
