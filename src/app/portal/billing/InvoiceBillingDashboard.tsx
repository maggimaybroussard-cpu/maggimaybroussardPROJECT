'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';


// ── Types ─────────────────────────────────────────────────────────────────────

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  amount: number;
  amount_paid: number;
  currency: string;
  status: string;
  line_items: InvoiceLineItem[];
  notes: string | null;
  description: string | null;
  created_at: string;
}

interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface Payment {
  id: string;
  payment_intent_id: string;
  amount: number;
  currency: string;
  payment_status: string;
  payment_type: string;
  description: string | null;
  customer_name: string;
  customer_email: string;
  created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(amount: number, currency = 'usd') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatDateShort(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getDaysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getStatusConfig(status: string) {
  switch (status) {
    case 'paid': return { label: 'Paid', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' };
    case 'sent': return { label: 'Due', color: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' };
    case 'pending': return { label: 'Pending', color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' };
    case 'overdue': return { label: 'Overdue', color: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' };
    case 'draft': return { label: 'Draft', color: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' };
    case 'cancelled': return { label: 'Cancelled', color: 'bg-gray-100 text-gray-500 border-gray-200', dot: 'bg-gray-400' };
    default: return { label: status, color: 'bg-gray-100 text-gray-600 border-gray-200', dot: 'bg-gray-400' };
  }
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function InvoiceBillingDashboard() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [activeTab, setActiveTab] = useState<'invoices' | 'payments' | 'summary'>('summary');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'paid' | 'overdue'>('all');

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: accessData } = await supabase
        .from('client_portal_access')
        .select('inquiry_id')
        .eq('user_id', user.id)
        .maybeSingle();

      const inquiryId = accessData?.inquiry_id ?? null;

      const [invoicesRes, paymentsRes] = await Promise.all([
        inquiryId
          ? supabase.from('client_invoices').select('*').eq('inquiry_id', inquiryId).order('created_at', { ascending: false })
          : supabase.from('client_invoices').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('payments').select('*').eq('customer_email', user.email).order('created_at', { ascending: false }).limit(20),
      ]);

      setInvoices(invoicesRes.data ?? []);
      setPayments(paymentsRes.data ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalBilled = invoices.reduce((sum, inv) => sum + inv.amount, 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + inv.amount_paid, 0);
  const totalOutstanding = invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled').reduce((sum, inv) => sum + (inv.amount - inv.amount_paid), 0);
  const overdueInvoices = invoices.filter(i => i.status === 'overdue');
  const pendingInvoices = invoices.filter(i => i.status === 'sent' || i.status === 'pending');

  const filteredInvoices = invoices.filter(inv => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'pending') return inv.status === 'sent' || inv.status === 'pending';
    if (filterStatus === 'paid') return inv.status === 'paid';
    if (filterStatus === 'overdue') return inv.status === 'overdue';
    return true;
  });

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-card border border-border rounded-2xl p-5 animate-pulse">
            <div className="w-32 h-4 bg-muted/50 rounded mb-3" />
            <div className="w-24 h-7 bg-muted/60 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overdue Alert */}
      {overdueInvoices.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-700">
              {overdueInvoices.length} overdue invoice{overdueInvoices.length !== 1 ? 's' : ''} — {formatCurrency(overdueInvoices.reduce((s, i) => s + (i.amount - i.amount_paid), 0))} past due
            </p>
            <p className="text-xs text-red-600 mt-0.5">Please make payment to avoid service interruption.</p>
          </div>
          <Link
            href="/portal/invoices"
            className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition-all"
          >
            Pay Now
          </Link>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Billed', value: formatCurrency(totalBilled), color: '#355E3B', icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
            </svg>
          )},
          { label: 'Total Paid', value: formatCurrency(totalPaid), color: '#059669', icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          )},
          { label: 'Outstanding', value: formatCurrency(totalOutstanding), color: totalOutstanding > 0 ? '#C8965A' : '#059669', icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          )},
          { label: 'Invoices', value: invoices.length.toString(), color: '#2563EB', icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
          )},
        ].map(stat => (
          <div key={stat.label} className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${stat.color}15`, color: stat.color }}>
                {stat.icon}
              </div>
              <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
            </div>
            <p className="text-xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary/40 rounded-xl p-1">
        {(['summary', 'invoices', 'payments'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {tab === 'summary' ? '📊 Summary' : tab === 'invoices' ? '📄 Invoices' : '💳 Payments'}
          </button>
        ))}
      </div>

      {/* Summary Tab */}
      {activeTab === 'summary' && (
        <div className="space-y-4">
          {/* Payment Progress */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Billing Overview</h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                  <span>Paid</span>
                  <span>{totalBilled > 0 ? Math.round((totalPaid / totalBilled) * 100) : 0}%</span>
                </div>
                <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${totalBilled > 0 ? (totalPaid / totalBilled) * 100 : 0}%`, background: '#059669' }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="text-center">
                  <p className="text-lg font-bold text-emerald-600">{formatCurrency(totalPaid)}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Paid</p>
                </div>
                <div className="text-center border-x border-border">
                  <p className="text-lg font-bold text-amber-600">{formatCurrency(totalOutstanding)}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Outstanding</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground">{formatCurrency(totalBilled)}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Total</p>
                </div>
              </div>
            </div>
          </div>

          {/* Pending Invoices */}
          {pendingInvoices.length > 0 && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border bg-amber-50/50 flex items-center justify-between">
                <p className="text-sm font-semibold text-amber-700">Awaiting Payment</p>
                <span className="text-xs text-amber-600 bg-amber-100 border border-amber-200 rounded-full px-2 py-0.5">{pendingInvoices.length}</span>
              </div>
              <div className="divide-y divide-border">
                {pendingInvoices.map(inv => {
                  const days = getDaysUntil(inv.due_date);
                  return (
                    <div key={inv.id} className="px-5 py-4 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">Invoice #{inv.invoice_number}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Due {formatDateShort(inv.due_date)}</p>
                        {days <= 3 && days >= 0 && (
                          <p className="text-xs text-amber-600 font-semibold mt-0.5">Due in {days} day{days !== 1 ? 's' : ''}</p>
                        )}
                        {days < 0 && (
                          <p className="text-xs text-red-600 font-semibold mt-0.5">{Math.abs(days)} day{Math.abs(days) !== 1 ? 's' : ''} overdue</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <p className="text-sm font-bold text-foreground">{formatCurrency(inv.amount - inv.amount_paid, inv.currency)}</p>
                        <Link
                          href="/portal/invoices"
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90"
                          style={{ background: '#355E3B', color: '#fff' }}
                        >
                          Pay
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent Activity */}
          {payments.length > 0 && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border">
                <p className="text-sm font-semibold text-foreground">Recent Payments</p>
              </div>
              <div className="divide-y divide-border">
                {payments.slice(0, 5).map(p => (
                  <div key={p.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground font-medium">{p.description ?? p.payment_type.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatDateShort(p.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <p className="text-sm font-bold text-emerald-600">{formatCurrency(p.amount / 100, p.currency)}</p>
                      <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">Paid</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Link
            href="/portal/invoices"
            className="block w-full py-3 rounded-xl text-center text-sm font-semibold border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
          >
            View All Invoices & Payment History →
          </Link>
        </div>
      )}

      {/* Invoices Tab */}
      {activeTab === 'invoices' && (
        <div className="space-y-4">
          {/* Filter */}
          <div className="flex gap-2 flex-wrap">
            {(['all', 'pending', 'paid', 'overdue'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilterStatus(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${filterStatus === f ? 'bg-foreground text-background' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {f !== 'all' && (
                  <span className="ml-1.5 opacity-70">
                    ({f === 'pending' ? pendingInvoices.length : f === 'paid' ? invoices.filter(i => i.status === 'paid').length : overdueInvoices.length})
                  </span>
                )}
              </button>
            ))}
          </div>

          {filteredInvoices.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-10 text-center">
              <p className="text-sm text-muted-foreground">No invoices found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredInvoices.map(inv => {
                const statusCfg = getStatusConfig(inv.status);
                const balance = inv.amount - inv.amount_paid;
                return (
                  <div
                    key={inv.id}
                    className={`bg-card border rounded-2xl overflow-hidden transition-all cursor-pointer hover:border-accent/40 ${selectedInvoice?.id === inv.id ? 'border-accent/60' : 'border-border'}`}
                    onClick={() => setSelectedInvoice(selectedInvoice?.id === inv.id ? null : inv)}
                  >
                    <div className="px-5 py-4 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-semibold text-foreground">Invoice #{inv.invoice_number}</p>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${statusCfg.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                            {statusCfg.label}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Issued {formatDateShort(inv.invoice_date)} · Due {formatDateShort(inv.due_date)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-base font-bold text-foreground">{formatCurrency(inv.amount, inv.currency)}</p>
                        {balance > 0 && balance < inv.amount && (
                          <p className="text-xs text-amber-600">{formatCurrency(balance)} remaining</p>
                        )}
                      </div>
                    </div>

                    {/* Expanded Detail */}
                    {selectedInvoice?.id === inv.id && (
                      <div className="border-t border-border px-5 py-4 bg-secondary/20">
                        {inv.line_items?.length > 0 && (
                          <div className="mb-4">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Line Items</p>
                            <div className="space-y-2">
                              {inv.line_items.map((item, i) => (
                                <div key={i} className="flex items-center justify-between text-sm">
                                  <span className="text-foreground/80">{item.description}</span>
                                  <span className="font-medium text-foreground">{formatCurrency(item.total)}</span>
                                </div>
                              ))}
                            </div>
                            <div className="flex items-center justify-between text-sm font-bold text-foreground border-t border-border mt-2 pt-2">
                              <span>Total</span>
                              <span>{formatCurrency(inv.amount, inv.currency)}</span>
                            </div>
                          </div>
                        )}
                        {inv.notes && (
                          <div className="mb-4">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Notes</p>
                            <p className="text-sm text-foreground/80">{inv.notes}</p>
                          </div>
                        )}
                        {(inv.status === 'sent' || inv.status === 'pending' || inv.status === 'overdue') && (
                          <Link
                            href="/portal/invoices"
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-90"
                            style={{ background: '#355E3B', color: '#fff' }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
                            </svg>
                            Pay Invoice
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Payments Tab */}
      {activeTab === 'payments' && (
        <div className="space-y-3">
          {payments.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-10 text-center">
              <p className="text-sm text-muted-foreground">No payment history found</p>
            </div>
          ) : (
            payments.map(p => (
              <div key={p.id} className="bg-card border border-border rounded-2xl px-5 py-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-50">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{p.description ?? p.payment_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatDate(p.created_at)}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-base font-bold text-emerald-600">{formatCurrency(p.amount / 100, p.currency)}</p>
                  <p className="text-xs text-emerald-600 font-medium">Confirmed</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
