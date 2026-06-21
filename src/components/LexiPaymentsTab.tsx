'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  amount: number;
  amount_paid: number;
  currency: string;
  status: string;
  notes: string | null;
  line_items: Array<{ description: string; quantity: number; unit_price: number; total: number }>;
}

function formatCurrency(amount: number, currency = 'usd') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDateShort(dateStr: string) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isOverdue(dueDateStr: string, status: string) {
  if (status === 'paid') return false;
  return new Date(dueDateStr) < new Date();
}

function getStatusBadge(status: string, dueDate: string) {
  if (status === 'paid') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (isOverdue(dueDate, status)) return 'bg-red-50 text-red-700 border-red-200';
  if (status === 'pending' || status === 'issued') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-gray-100 text-gray-600 border-gray-200';
}

function getStatusLabel(status: string, dueDate: string) {
  if (status === 'paid') return 'Paid';
  if (isOverdue(dueDate, status)) return 'Overdue';
  if (status === 'pending') return 'Pending';
  if (status === 'issued') return 'Issued';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

interface LexiPaymentsTabProps {
  clientName?: string;
  caseRef?: string;
}

export default function LexiPaymentsTab({ clientName, caseRef }: LexiPaymentsTabProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      let query = supabase
        .from('client_invoices')
        .select('id, invoice_number, invoice_date, due_date, amount, amount_paid, currency, status, notes, line_items')
        .order('due_date', { ascending: true });

      // Filter by client name if a session is active
      if (clientName) {
        // Try to find by notes or invoice metadata containing client name
        // We'll fetch all and filter client-side since there's no direct client_name column
        // but also try inquiry-based lookup via the API
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setInvoices(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [clientName]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const handlePayNow = async (invoice: Invoice) => {
    setPayingId(invoice.id);
    setPayError(null);
    try {
      const res = await fetch('/api/invoices/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoice_number,
          description: invoice.notes || `Invoice ${invoice.invoice_number}`,
          amount: invoice.amount - (invoice.amount_paid || 0),
          currency: invoice.currency || 'usd',
          dueDate: invoice.due_date,
          successPath: '/portal/billing',
          cancelPath: '/portal/billing',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create payment session');
      if (data.url) {
        window.open(data.url, '_blank');
      }
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setPayingId(null);
    }
  };

  const pendingInvoices = invoices.filter(inv => inv.status !== 'paid');
  const displayInvoices = filter === 'pending' ? pendingInvoices : invoices;

  const totalPending = pendingInvoices.reduce((sum, inv) => sum + (inv.amount - (inv.amount_paid || 0)), 0);
  const overdueInvoices = pendingInvoices.filter(inv => isOverdue(inv.due_date, inv.status));

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header summary */}
      <div className="px-4 py-3 border-b border-border bg-secondary/40 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-base">💳</span>
            <div>
              <p className="text-sm font-semibold text-foreground">Client Payments</p>
              <p className="text-[10px] text-muted-foreground">
                {clientName ? `${clientName}${caseRef ? ` · ${caseRef}` : ''}` : 'All pending invoices'}
              </p>
            </div>
          </div>
          <button
            onClick={fetchInvoices}
            disabled={loading}
            className="p-1.5 rounded-lg hover:bg-border/50 transition-colors text-muted-foreground hover:text-foreground"
            title="Refresh"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={loading ? 'animate-spin' : ''}>
              <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>
        </div>

        {/* Stats row */}
        {!loading && (
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-background rounded-lg p-2 text-center border border-border">
              <p className="text-[10px] text-muted-foreground">Pending</p>
              <p className="text-sm font-bold text-foreground">{pendingInvoices.length}</p>
            </div>
            <div className="bg-background rounded-lg p-2 text-center border border-border">
              <p className="text-[10px] text-muted-foreground">Total Due</p>
              <p className="text-sm font-bold text-amber-600">{formatCurrency(totalPending)}</p>
            </div>
            <div className="bg-background rounded-lg p-2 text-center border border-border">
              <p className="text-[10px] text-muted-foreground">Overdue</p>
              <p className={`text-sm font-bold ${overdueInvoices.length > 0 ? 'text-red-600' : 'text-foreground'}`}>
                {overdueInvoices.length}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Filter toggle */}
      <div className="flex border-b border-border shrink-0">
        <button
          onClick={() => setFilter('pending')}
          className={`flex-1 py-2 text-[11px] font-semibold transition-colors ${filter === 'pending' ? 'text-primary border-b-2 border-primary bg-primary/3' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Pending ({pendingInvoices.length})
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`flex-1 py-2 text-[11px] font-semibold transition-colors ${filter === 'all' ? 'text-primary border-b-2 border-primary bg-primary/3' : 'text-muted-foreground hover:text-foreground'}`}
        >
          All Invoices ({invoices.length})
        </button>
      </div>

      {/* Invoice list */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {payError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
            <span className="text-red-500 text-sm shrink-0">⚠️</span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-red-800">Payment Error</p>
              <p className="text-[11px] text-red-700 mt-0.5">{payError}</p>
            </div>
            <button onClick={() => setPayError(null)} className="ml-auto text-red-400 hover:text-red-600 shrink-0">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-muted-foreground">Loading invoices…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
            <span className="text-3xl">⚠️</span>
            <p className="text-xs text-muted-foreground">{error}</p>
            <button onClick={fetchInvoices} className="text-xs text-primary underline">Try again</button>
          </div>
        ) : displayInvoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {filter === 'pending' ? 'No pending invoices' : 'No invoices found'}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {filter === 'pending' ? 'All invoices are paid or up to date.' : 'No invoices have been issued yet.'}
              </p>
            </div>
          </div>
        ) : (
          displayInvoices.map(invoice => {
            const balance = invoice.amount - (invoice.amount_paid || 0);
            const overdue = isOverdue(invoice.due_date, invoice.status);
            const isPaid = invoice.status === 'paid';
            const isPaying = payingId === invoice.id;

            return (
              <div
                key={invoice.id}
                className={`rounded-xl border p-3 transition-all ${overdue && !isPaid ? 'border-red-200 bg-red-50/30' : isPaid ? 'border-emerald-200 bg-emerald-50/20' : 'border-border bg-background'}`}
              >
                {/* Invoice header */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-bold text-foreground">#{invoice.invoice_number}</p>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getStatusBadge(invoice.status, invoice.due_date)}`}>
                        {getStatusLabel(invoice.status, invoice.due_date)}
                      </span>
                      {overdue && !isPaid && (
                        <span className="text-[10px] font-semibold text-red-600">
                          {Math.floor((new Date().getTime() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24))}d overdue
                        </span>
                      )}
                    </div>
                    {invoice.notes && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{invoice.notes}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold ${isPaid ? 'text-emerald-700' : overdue ? 'text-red-700' : 'text-foreground'}`}>
                      {formatCurrency(isPaid ? invoice.amount : balance, invoice.currency)}
                    </p>
                    {invoice.amount_paid > 0 && !isPaid && (
                      <p className="text-[10px] text-muted-foreground">{formatCurrency(invoice.amount_paid)} paid</p>
                    )}
                  </div>
                </div>

                {/* Line items preview */}
                {invoice.line_items && invoice.line_items.length > 0 && (
                  <div className="mb-2 bg-secondary/50 rounded-lg p-2">
                    {invoice.line_items.slice(0, 2).map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-[10px] text-muted-foreground">
                        <span className="truncate mr-2">{item.description}</span>
                        <span className="shrink-0 font-medium">{formatCurrency(item.total, invoice.currency)}</span>
                      </div>
                    ))}
                    {invoice.line_items.length > 2 && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">+{invoice.line_items.length - 2} more items</p>
                    )}
                  </div>
                )}

                {/* Dates + action */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Issued</p>
                      <p className="text-[10px] font-medium text-foreground">{formatDateShort(invoice.invoice_date)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Due</p>
                      <p className={`text-[10px] font-medium ${overdue && !isPaid ? 'text-red-600' : 'text-foreground'}`}>
                        {formatDateShort(invoice.due_date)}
                      </p>
                    </div>
                  </div>

                  {!isPaid && (
                    <button
                      onClick={() => handlePayNow(invoice)}
                      disabled={isPaying}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all disabled:opacity-60 ${
                        overdue
                          ? 'bg-red-600 text-white hover:bg-red-700' :'bg-primary text-primary-foreground hover:opacity-90'
                      }`}
                    >
                      {isPaying ? (
                        <>
                          <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          Processing…
                        </>
                      ) : (
                        <>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
                          </svg>
                          Pay {formatCurrency(balance, invoice.currency)}
                        </>
                      )}
                    </button>
                  )}

                  {isPaid && (
                    <div className="flex items-center gap-1 text-emerald-600">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      <span className="text-[11px] font-semibold">Paid</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer note */}
      <div className="px-4 py-2.5 border-t border-border bg-secondary/30 shrink-0">
        <p className="text-[10px] text-muted-foreground text-center">
          Payments are processed securely via Stripe. You'll be redirected to complete payment.
        </p>
      </div>
    </div>
  );
}
