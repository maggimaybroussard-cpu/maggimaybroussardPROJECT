'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface IoltaAccount {
  id: string;
  account_name: string;
  bank_name: string | null;
  account_number_last4: string | null;
  current_balance: number;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

interface IoltaTransaction {
  id: string;
  account_id: string;
  inquiry_id: string | null;
  transaction_type: 'deposit' | 'disbursement' | 'transfer' | 'fee_earned' | 'adjustment';
  amount: number;
  description: string;
  reference_number: string | null;
  transaction_date: string;
  cleared: boolean;
  cleared_date: string | null;
  running_balance: number | null;
  created_by: string | null;
  created_at: string;
  contact_inquiries?: { name: string; service: string } | null;
}

interface IoltaReconciliation {
  id: string;
  account_id: string;
  reconciliation_date: string;
  statement_balance: number;
  book_balance: number;
  difference: number;
  is_balanced: boolean;
  notes: string | null;
  reconciled_by: string | null;
  created_at: string;
}

type ActiveView = 'ledger' | 'reconciliation' | 'add_transaction';

const TRANSACTION_TYPES = [
  { value: 'deposit', label: 'Deposit', color: 'text-emerald-700 bg-emerald-50 border-emerald-200', sign: '+' },
  { value: 'disbursement', label: 'Disbursement', color: 'text-red-700 bg-red-50 border-red-200', sign: '-' },
  { value: 'transfer', label: 'Transfer', color: 'text-blue-700 bg-blue-50 border-blue-200', sign: '±' },
  { value: 'fee_earned', label: 'Fee Earned', color: 'text-violet-700 bg-violet-50 border-violet-200', sign: '-' },
  { value: 'adjustment', label: 'Adjustment', color: 'text-amber-700 bg-amber-50 border-amber-200', sign: '±' },
];

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function IOLTATrustLedger() {
  const supabase = createClient();
  const [activeView, setActiveView] = useState<ActiveView>('ledger');
  const [account, setAccount] = useState<IoltaAccount | null>(null);
  const [transactions, setTransactions] = useState<IoltaTransaction[]>([]);
  const [reconciliations, setReconciliations] = useState<IoltaReconciliation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Add transaction form
  const [txForm, setTxForm] = useState({
    transaction_type: 'deposit',
    amount: '',
    description: '',
    reference_number: '',
    transaction_date: new Date().toISOString().split('T')[0],
    cleared: false,
  });

  // Reconciliation form
  const [reconForm, setReconForm] = useState({
    reconciliation_date: new Date().toISOString().split('T')[0],
    statement_balance: '',
    notes: '',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [acctRes, txRes, reconRes] = await Promise.all([
        supabase.from('iolta_accounts').select('*').eq('is_active', true).limit(1).maybeSingle(),
        supabase.from('iolta_transactions').select('*, contact_inquiries(name, service)').order('transaction_date', { ascending: false }).order('created_at', { ascending: false }).limit(100),
        supabase.from('iolta_reconciliations').select('*').order('reconciliation_date', { ascending: false }).limit(20),
      ]);
      if (acctRes.data) setAccount(acctRes.data);
      setTransactions(txRes.data || []);
      setReconciliations(reconRes.data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load IOLTA data');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAddTransaction = async () => {
    if (!account) return;
    if (!txForm.amount || !txForm.description) {
      setError('Amount and description are required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const amount = parseFloat(txForm.amount);
      const isDebit = txForm.transaction_type === 'disbursement' || txForm.transaction_type === 'fee_earned';
      const balanceDelta = isDebit ? -amount : amount;

      const { error: txErr } = await supabase.from('iolta_transactions').insert({
        account_id: account.id,
        transaction_type: txForm.transaction_type,
        amount,
        description: txForm.description,
        reference_number: txForm.reference_number || null,
        transaction_date: txForm.transaction_date,
        cleared: txForm.cleared,
        created_by: 'Admin',
      });
      if (txErr) throw txErr;

      // Update account balance
      const { error: balErr } = await supabase.from('iolta_accounts').update({
        current_balance: (account.current_balance || 0) + balanceDelta,
        updated_at: new Date().toISOString(),
      }).eq('id', account.id);
      if (balErr) throw balErr;

      setSuccessMsg('Transaction recorded successfully');
      setTxForm({ transaction_type: 'deposit', amount: '', description: '', reference_number: '', transaction_date: new Date().toISOString().split('T')[0], cleared: false });
      setActiveView('ledger');
      await fetchData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save transaction');
    } finally {
      setSaving(false);
    }
  };

  const handleReconcile = async () => {
    if (!account) return;
    if (!reconForm.statement_balance) {
      setError('Statement balance is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const stmtBal = parseFloat(reconForm.statement_balance);
      const bookBal = account.current_balance;
      const isBalanced = Math.abs(stmtBal - bookBal) < 0.01;

      const { error: reconErr } = await supabase.from('iolta_reconciliations').insert({
        account_id: account.id,
        reconciliation_date: reconForm.reconciliation_date,
        statement_balance: stmtBal,
        book_balance: bookBal,
        is_balanced: isBalanced,
        notes: reconForm.notes || null,
        reconciled_by: 'Admin',
      });
      if (reconErr) throw reconErr;

      setSuccessMsg(isBalanced ? '✓ Account reconciled — balances match!' : '⚠ Reconciliation saved — discrepancy noted');
      setReconForm({ reconciliation_date: new Date().toISOString().split('T')[0], statement_balance: '', notes: '' });
      await fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save reconciliation');
    } finally {
      setSaving(false);
    }
  };

  const toggleCleared = async (tx: IoltaTransaction) => {
    await supabase.from('iolta_transactions').update({
      cleared: !tx.cleared,
      cleared_date: !tx.cleared ? new Date().toISOString().split('T')[0] : null,
    }).eq('id', tx.id);
    await fetchData();
  };

  const totalDeposits = transactions.filter(t => t.transaction_type === 'deposit').reduce((s, t) => s + t.amount, 0);
  const totalDisbursements = transactions.filter(t => t.transaction_type === 'disbursement' || t.transaction_type === 'fee_earned').reduce((s, t) => s + t.amount, 0);
  const unclearedCount = transactions.filter(t => !t.cleared).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-6 py-5 border-b border-border bg-gradient-to-r from-emerald-50/60 to-transparent">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ background: '#355E3B' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M7 15h.01"/><path d="M11 15h2"/>
                </svg>
              </div>
              <div>
                <h2 className="font-serif text-xl text-foreground">{account?.account_name || 'IOLTA Trust Account'}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{account?.bank_name || 'Trust Account'} · IOLTA Ledger</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-semibold text-foreground">{fmt(account?.current_balance || 0)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Current Balance</p>
            </div>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-3 divide-x divide-border">
          <div className="px-5 py-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Total Deposits</p>
            <p className="text-lg font-semibold text-emerald-700">{fmt(totalDeposits)}</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Total Disbursed</p>
            <p className="text-lg font-semibold text-red-600">{fmt(totalDisbursements)}</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Uncleared Items</p>
            <p className="text-lg font-semibold text-amber-600">{unclearedCount}</p>
          </div>
        </div>
      </div>

      {/* Success / Error */}
      {successMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          {successMsg}
        </div>
      )}
      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {/* Tab Nav */}
      <div className="flex gap-1 p-1 bg-secondary/40 rounded-xl border border-border w-fit">
        {[
          { id: 'ledger', label: 'Ledger' },
          { id: 'reconciliation', label: 'Reconciliation' },
          { id: 'add_transaction', label: '+ Add Transaction' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveView(tab.id as ActiveView)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-widest transition-all ${
              activeView === tab.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Ledger View */}
      {activeView === 'ledger' && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading ledger…</div>
          ) : transactions.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-muted-foreground text-sm">No transactions yet. Add your first transaction to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/40">
                    <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Date</th>
                    <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Description</th>
                    <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden md:table-cell">Type</th>
                    <th className="text-right px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Amount</th>
                    <th className="text-center px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden sm:table-cell">Cleared</th>
                    <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden lg:table-cell">Ref #</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx, i) => {
                    const typeConfig = TRANSACTION_TYPES.find(t => t.value === tx.transaction_type);
                    const isDebit = tx.transaction_type === 'disbursement' || tx.transaction_type === 'fee_earned';
                    return (
                      <tr key={tx.id} className={`border-b border-border last:border-0 transition-colors ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                        <td className="px-5 py-3.5 text-muted-foreground whitespace-nowrap">{fmtDate(tx.transaction_date)}</td>
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-foreground">{tx.description}</p>
                          {tx.contact_inquiries && (
                            <p className="text-xs text-muted-foreground mt-0.5">{tx.contact_inquiries.name} · {tx.contact_inquiries.service}</p>
                          )}
                        </td>
                        <td className="px-5 py-3.5 hidden md:table-cell">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${typeConfig?.color}`}>
                            {typeConfig?.label}
                          </span>
                        </td>
                        <td className={`px-5 py-3.5 text-right font-semibold tabular-nums ${isDebit ? 'text-red-600' : 'text-emerald-700'}`}>
                          {isDebit ? '-' : '+'}{fmt(tx.amount)}
                        </td>
                        <td className="px-5 py-3.5 text-center hidden sm:table-cell">
                          <button onClick={() => toggleCleared(tx)} className={`w-5 h-5 rounded border-2 flex items-center justify-center mx-auto transition-colors ${tx.cleared ? 'bg-emerald-500 border-emerald-500' : 'border-border hover:border-emerald-400'}`}>
                            {tx.cleared && (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            )}
                          </button>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-muted-foreground hidden lg:table-cell">{tx.reference_number || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Reconciliation View */}
      {activeView === 'reconciliation' && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Reconcile Form */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <h3 className="font-serif text-lg text-foreground mb-4">New Reconciliation</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Reconciliation Date</label>
                <input type="date" value={reconForm.reconciliation_date} onChange={e => setReconForm(p => ({ ...p, reconciliation_date: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Bank Statement Balance</label>
                <input type="number" step="0.01" placeholder="0.00" value={reconForm.statement_balance} onChange={e => setReconForm(p => ({ ...p, statement_balance: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40" />
              </div>
              <div className="p-4 rounded-xl bg-secondary/40 border border-border">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Book Balance (System)</span>
                  <span className="font-semibold text-foreground">{fmt(account?.current_balance || 0)}</span>
                </div>
                {reconForm.statement_balance && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Difference</span>
                    <span className={`font-semibold ${Math.abs(parseFloat(reconForm.statement_balance) - (account?.current_balance || 0)) < 0.01 ? 'text-emerald-700' : 'text-red-600'}`}>
                      {fmt(parseFloat(reconForm.statement_balance) - (account?.current_balance || 0))}
                    </span>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Notes</label>
                <textarea rows={3} placeholder="Reconciliation notes…" value={reconForm.notes} onChange={e => setReconForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 resize-none" />
              </div>
              <button onClick={handleReconcile} disabled={saving || !reconForm.statement_balance}
                className="w-full py-2.5 rounded-xl text-white text-xs font-semibold uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: '#355E3B' }}>
                {saving ? 'Saving…' : 'Save Reconciliation'}
              </button>
            </div>
          </div>

          {/* Reconciliation History */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-serif text-lg text-foreground">Reconciliation History</h3>
            </div>
            {reconciliations.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">No reconciliations yet.</div>
            ) : (
              <div className="divide-y divide-border">
                {reconciliations.map(r => (
                  <div key={r.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground text-sm">{fmtDate(r.reconciliation_date)}</p>
                        {r.notes && <p className="text-xs text-muted-foreground mt-0.5">{r.notes}</p>}
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${r.is_balanced ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                        {r.is_balanced ? '✓ Balanced' : '⚠ Discrepancy'}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                      <div><span className="text-muted-foreground">Statement</span><br /><span className="font-semibold">{fmt(r.statement_balance)}</span></div>
                      <div><span className="text-muted-foreground">Book</span><br /><span className="font-semibold">{fmt(r.book_balance)}</span></div>
                      <div><span className="text-muted-foreground">Difference</span><br /><span className={`font-semibold ${r.is_balanced ? 'text-emerald-700' : 'text-red-600'}`}>{fmt(r.difference)}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Transaction View */}
      {activeView === 'add_transaction' && (
        <div className="rounded-2xl border border-border bg-card p-6 max-w-lg">
          <h3 className="font-serif text-lg text-foreground mb-5">Record Transaction</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Transaction Type</label>
              <div className="grid grid-cols-2 gap-2">
                {TRANSACTION_TYPES.map(t => (
                  <button key={t.value} onClick={() => setTxForm(p => ({ ...p, transaction_type: t.value }))}
                    className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${txForm.transaction_type === t.value ? t.color : 'border-border text-muted-foreground hover:border-accent/50'}`}>
                    {t.sign} {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Amount ($)</label>
              <input type="number" step="0.01" placeholder="0.00" value={txForm.amount} onChange={e => setTxForm(p => ({ ...p, amount: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Description *</label>
              <input type="text" placeholder="e.g. Client retainer deposit — Smith v. Jones" value={txForm.description} onChange={e => setTxForm(p => ({ ...p, description: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Date</label>
                <input type="date" value={txForm.transaction_date} onChange={e => setTxForm(p => ({ ...p, transaction_date: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Reference #</label>
                <input type="text" placeholder="Check # or wire ref" value={txForm.reference_number} onChange={e => setTxForm(p => ({ ...p, reference_number: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40" />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={txForm.cleared} onChange={e => setTxForm(p => ({ ...p, cleared: e.target.checked }))} className="rounded" />
              <span className="text-sm text-foreground">Mark as cleared</span>
            </label>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setActiveView('ledger')} className="flex-1 py-2.5 rounded-xl border border-border text-foreground text-xs font-semibold uppercase tracking-widest hover:bg-secondary/40 transition-all">
                Cancel
              </button>
              <button onClick={handleAddTransaction} disabled={saving || !txForm.amount || !txForm.description}
                className="flex-1 py-2.5 rounded-xl text-white text-xs font-semibold uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: '#355E3B' }}>
                {saving ? 'Saving…' : 'Record Transaction'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
