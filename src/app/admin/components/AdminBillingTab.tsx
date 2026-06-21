'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface HourlyRate {
  id: string;
  service_type: string;
  rate_per_hour: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  amount: number;
  amount_paid: number;
  status: string;
  notes: string | null;
  inquiry_id: string | null;
  payment_type: string | null;
  created_at: string;
  contact_inquiries?: {
    name: string;
    email: string;
    service: string;
  } | null;
}

interface Timelog {
  id: string;
  hours: number;
  description: string | null;
  work_date: string;
  hourly_rate: number | null;
  case_task: string | null;
  logged_by: string | null;
  inquiry_id: string | null;
  invoice_id: string | null;
  contact_inquiries?: {
    name: string;
    service: string;
  } | null;
}

interface MatterRevenue {
  matterName: string;
  service: string;
  inquiryId: string;
  totalBilled: number;
  totalPaid: number;
  totalHours: number;
  invoiceCount: number;
  lastActivity: string;
}

interface NewInvoiceForm {
  inquiry_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  amount: string;
  notes: string;
  payment_type: string;
  line_items: { description: string; quantity: number; rate: number; amount: number }[];
}

interface NewRateForm {
  service_type: string;
  rate_per_hour: string;
  description: string;
}

type BillingSubTab = 'rates' | 'generate' | 'revenue' | 'history';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_COLORS: Record<string, string> = {
  paid: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  overdue: 'bg-red-100 text-red-700 border-red-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
};

// ─── Sub-tab: Hourly Rates ────────────────────────────────────────────────────

function HourlyRatesPanel() {
  const supabase = createClient();
  const [rates, setRates] = useState<HourlyRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRate, setEditRate] = useState<string>('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<NewRateForm>({ service_type: '', rate_per_hour: '', description: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchRates = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('billing_hourly_rates')
      .select('*')
      .order('service_type');
    setRates(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchRates(); }, [fetchRates]);

  async function handleSaveRate(id: string) {
    setSaving(true);
    setError('');
    const rate = parseFloat(editRate);
    if (isNaN(rate) || rate <= 0) { setError('Enter a valid rate.'); setSaving(false); return; }
    const { error: err } = await supabase
      .from('billing_hourly_rates')
      .update({ rate_per_hour: rate, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (err) { setError(err.message); } else { setSuccess('Rate updated.'); setEditingId(null); fetchRates(); }
    setSaving(false);
    setTimeout(() => setSuccess(''), 3000);
  }

  async function handleToggleActive(id: string, current: boolean) {
    await supabase.from('billing_hourly_rates').update({ is_active: !current }).eq('id', id);
    fetchRates();
  }

  async function handleAddRate() {
    setSaving(true);
    setError('');
    const rate = parseFloat(form.rate_per_hour);
    if (!form.service_type.trim()) { setError('Service type is required.'); setSaving(false); return; }
    if (isNaN(rate) || rate <= 0) { setError('Enter a valid hourly rate.'); setSaving(false); return; }
    const { error: err } = await supabase.from('billing_hourly_rates').insert({
      service_type: form.service_type.trim(),
      rate_per_hour: rate,
      description: form.description.trim() || null,
      is_active: true,
    });
    if (err) { setError(err.message); } else {
      setSuccess('Rate added.'); setShowAdd(false);
      setForm({ service_type: '', rate_per_hour: '', description: '' });
      fetchRates();
    }
    setSaving(false);
    setTimeout(() => setSuccess(''), 3000);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Hourly Rate Schedule</h3>
          <p className="text-sm text-muted-foreground mt-0.5">Set and manage billing rates by service type</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
          style={{ background: '#355E3B' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add Rate
        </button>
      </div>

      {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
      {success && <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">{success}</div>}

      {showAdd && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <h4 className="font-semibold text-foreground text-sm">New Billing Rate</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Service Type</label>
              <input
                type="text"
                value={form.service_type}
                onChange={e => setForm(f => ({ ...f, service_type: e.target.value }))}
                placeholder="e.g. Family Law, Immigration"
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Rate / Hour ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.rate_per_hour}
                onChange={e => setForm(f => ({ ...f, rate_per_hour: e.target.value }))}
                placeholder="350.00"
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Description (optional)</label>
              <input
                type="text"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Brief note"
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-all">Cancel</button>
            <button
              onClick={handleAddRate}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
              style={{ background: '#355E3B' }}
            >
              {saving ? 'Saving…' : 'Save Rate'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="h-16 bg-muted/30 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : rates.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-muted/40 flex items-center justify-center mx-auto mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
              <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
          </div>
          <p className="text-muted-foreground text-sm">No hourly rates configured yet. Add your first rate above.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40">
                <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Service Type</th>
                <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Rate / Hour</th>
                <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden md:table-cell">Description</th>
                <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rates.map((r, i) => (
                <tr key={r.id} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                  <td className="px-5 py-3.5 font-medium text-foreground">{r.service_type}</td>
                  <td className="px-5 py-3.5">
                    {editingId === r.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editRate}
                          onChange={e => setEditRate(e.target.value)}
                          className="w-28 px-2 py-1.5 rounded-lg border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
                        />
                        <button onClick={() => handleSaveRate(r.id)} disabled={saving} className="text-xs px-2.5 py-1.5 rounded-lg font-semibold text-white" style={{ background: '#355E3B' }}>Save</button>
                        <button onClick={() => setEditingId(null)} className="text-xs px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground">Cancel</button>
                      </div>
                    ) : (
                      <span className="font-semibold text-foreground">{fmt(r.rate_per_hour)}</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground hidden md:table-cell">{r.description ?? '—'}</td>
                  <td className="px-5 py-3.5">
                    <button
                      onClick={() => handleToggleActive(r.id, r.is_active)}
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${r.is_active ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}
                    >
                      {r.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-5 py-3.5">
                    <button
                      onClick={() => { setEditingId(r.id); setEditRate(String(r.rate_per_hour)); }}
                      className="text-muted-foreground/50 hover:text-foreground transition-colors"
                      aria-label="Edit rate"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Sub-tab: Generate Invoice ────────────────────────────────────────────────

function GenerateInvoicePanel() {
  const supabase = createClient();
  const [matters, setMatters] = useState<{ id: string; name: string; service: string }[]>([]);
  const [rates, setRates] = useState<HourlyRate[]>([]);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState<NewInvoiceForm>({
    inquiry_id: '',
    invoice_number: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    amount: '',
    notes: '',
    payment_type: 'general',
    line_items: [{ description: '', quantity: 1, rate: 0, amount: 0 }],
  });

  useEffect(() => {
    async function load() {
      const [{ data: inq }, { data: r }] = await Promise.all([
        supabase.from('contact_inquiries').select('id, name, service').order('created_at', { ascending: false }).limit(100),
        supabase.from('billing_hourly_rates').select('*').eq('is_active', true).order('service_type'),
      ]);
      setMatters((inq ?? []).map(i => ({ id: i.id, name: i.name, service: i.service })));
      setRates(r ?? []);
    }
    load();
  }, [supabase]);

  function updateLineItem(idx: number, field: string, value: string | number) {
    setForm(f => {
      const items = [...f.line_items];
      items[idx] = { ...items[idx], [field]: value };
      if (field === 'quantity' || field === 'rate') {
        items[idx].amount = Number(items[idx].quantity) * Number(items[idx].rate);
      }
      const total = items.reduce((s, it) => s + it.amount, 0);
      return { ...f, line_items: items, amount: String(total) };
    });
  }

  function addLineItem() {
    setForm(f => ({ ...f, line_items: [...f.line_items, { description: '', quantity: 1, rate: 0, amount: 0 }] }));
  }

  function removeLineItem(idx: number) {
    setForm(f => {
      const items = f.line_items.filter((_, i) => i !== idx);
      const total = items.reduce((s, it) => s + it.amount, 0);
      return { ...f, line_items: items, amount: String(total) };
    });
  }

  function applyRate(idx: number, rateValue: number) {
    setForm(f => {
      const items = [...f.line_items];
      items[idx] = { ...items[idx], rate: rateValue, amount: Number(items[idx].quantity) * rateValue };
      const total = items.reduce((s, it) => s + it.amount, 0);
      return { ...f, line_items: items, amount: String(total) };
    });
  }

  async function handleGenerate() {
    setSaving(true);
    setError('');
    const amount = parseFloat(form.amount);
    if (!form.invoice_number.trim()) { setError('Invoice number is required.'); setSaving(false); return; }
    if (!form.due_date) { setError('Due date is required.'); setSaving(false); return; }
    if (isNaN(amount) || amount <= 0) { setError('Total amount must be greater than 0.'); setSaving(false); return; }

    const { error: err } = await supabase.from('client_invoices').insert({
      inquiry_id: form.inquiry_id || null,
      invoice_number: form.invoice_number.trim(),
      invoice_date: form.invoice_date,
      due_date: form.due_date,
      amount,
      amount_paid: 0,
      status: 'pending',
      notes: form.notes.trim() || null,
      payment_type: form.payment_type,
      line_items: form.line_items.filter(li => li.description.trim()),
    });

    if (err) {
      setError(err.message);
    } else {
      setSuccess(`Invoice ${form.invoice_number} generated successfully.`);
      setForm({
        inquiry_id: '',
        invoice_number: `INV-${Date.now().toString().slice(-6)}`,
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        amount: '',
        notes: '',
        payment_type: 'general',
        line_items: [{ description: '', quantity: 1, rate: 0, amount: 0 }],
      });
    }
    setSaving(false);
    setTimeout(() => setSuccess(''), 5000);
  }

  const total = form.line_items.reduce((s, li) => s + li.amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Generate Invoice</h3>
        <p className="text-sm text-muted-foreground mt-0.5">Create a new invoice for a client matter</p>
      </div>

      {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
      {success && <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">{success}</div>}

      <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
        {/* Header fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Matter / Client</label>
            <select
              value={form.inquiry_id}
              onChange={e => setForm(f => ({ ...f, inquiry_id: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all appearance-none"
            >
              <option value="">— No matter linked —</option>
              {matters.map(m => (
                <option key={m.id} value={m.id}>{m.name} ({m.service})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Invoice Number</label>
            <input
              type="text"
              value={form.invoice_number}
              onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))}
              placeholder={`INV-${Date.now().toString().slice(-6)}`}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Payment Type</label>
            <select
              value={form.payment_type}
              onChange={e => setForm(f => ({ ...f, payment_type: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all appearance-none"
            >
              <option value="general">General</option>
              <option value="retainer">Retainer</option>
              <option value="consultation">Consultation</option>
              <option value="flat_fee">Flat Fee</option>
              <option value="hourly">Hourly</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Invoice Date</label>
            <input
              type="date"
              value={form.invoice_date}
              onChange={e => setForm(f => ({ ...f, invoice_date: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Due Date</label>
            <input
              type="date"
              value={form.due_date}
              onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
            />
          </div>
        </div>

        {/* Line items */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Line Items</label>
            <button onClick={addLineItem} className="text-xs text-accent hover:underline flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add Line
            </button>
          </div>
          <div className="space-y-2">
            {form.line_items.map((li, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-5">
                  <input
                    type="text"
                    value={li.description}
                    onChange={e => updateLineItem(idx, 'description', e.target.value)}
                    placeholder="Description"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={li.quantity}
                    onChange={e => updateLineItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                    placeholder="Qty"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
                  />
                </div>
                <div className="col-span-2 relative">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={li.rate}
                    onChange={e => updateLineItem(idx, 'rate', parseFloat(e.target.value) || 0)}
                    placeholder="Rate"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
                  />
                  {rates.length > 0 && (
                    <select
                      onChange={e => { if (e.target.value) applyRate(idx, parseFloat(e.target.value)); }}
                      className="absolute right-1 top-1 h-7 text-xs border-0 bg-transparent text-accent cursor-pointer focus:outline-none"
                      defaultValue=""
                    >
                      <option value="">↓</option>
                      {rates.map(r => <option key={r.id} value={r.rate_per_hour}>{r.service_type}</option>)}
                    </select>
                  )}
                </div>
                <div className="col-span-2 text-right text-sm font-semibold text-foreground pr-1">
                  {fmt(li.amount)}
                </div>
                <div className="col-span-1 flex justify-end">
                  {form.line_items.length > 1 && (
                    <button onClick={() => removeLineItem(idx)} className="text-muted-foreground/40 hover:text-red-500 transition-colors">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end mt-3 pt-3 border-t border-border">
            <div className="text-right">
              <span className="text-xs text-muted-foreground uppercase tracking-widest mr-4">Total</span>
              <span className="text-xl font-bold text-foreground">{fmt(total)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Notes (optional)</label>
          <textarea
            rows={2}
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Payment terms, special instructions…"
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all resize-none"
          />
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleGenerate}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
            style={{ background: '#355E3B' }}
          >
            {saving ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Generating…
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
                Generate Invoice
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-tab: Revenue Per Matter ──────────────────────────────────────────────

function RevenuePerMatterPanel() {
  const supabase = createClient();
  const [matters, setMatters] = useState<MatterRevenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: invoices } = await supabase
        .from('client_invoices')
        .select('id, amount, amount_paid, status, inquiry_id, created_at, contact_inquiries(name, service)')
        .not('inquiry_id', 'is', null);

      const { data: timelogs } = await supabase
        .from('retainer_time_logs')
        .select('hours, inquiry_id, work_date')
        .not('inquiry_id', 'is', null);

      const map: Record<string, MatterRevenue> = {};

      for (const inv of invoices ?? []) {
        const inq = inv.contact_inquiries as { name: string; service: string } | null;
        if (!inv.inquiry_id || !inq) continue;
        if (!map[inv.inquiry_id]) {
          map[inv.inquiry_id] = {
            matterName: inq.name,
            service: inq.service,
            inquiryId: inv.inquiry_id,
            totalBilled: 0,
            totalPaid: 0,
            totalHours: 0,
            invoiceCount: 0,
            lastActivity: inv.created_at,
          };
        }
        map[inv.inquiry_id].totalBilled += Number(inv.amount) || 0;
        map[inv.inquiry_id].totalPaid += Number(inv.amount_paid) || 0;
        map[inv.inquiry_id].invoiceCount += 1;
        if (inv.created_at > map[inv.inquiry_id].lastActivity) {
          map[inv.inquiry_id].lastActivity = inv.created_at;
        }
      }

      for (const tl of timelogs ?? []) {
        if (!tl.inquiry_id) continue;
        if (map[tl.inquiry_id]) {
          map[tl.inquiry_id].totalHours += Number(tl.hours) || 0;
        }
      }

      setMatters(Object.values(map).sort((a, b) => b.totalBilled - a.totalBilled));
      setLoading(false);
    }
    load();
  }, [supabase]);

  const filtered = matters.filter(m =>
    m.matterName.toLowerCase().includes(search.toLowerCase()) ||
    m.service.toLowerCase().includes(search.toLowerCase())
  );

  const totalRevenue = matters.reduce((s, m) => s + m.totalBilled, 0);
  const totalCollected = matters.reduce((s, m) => s + m.totalPaid, 0);
  const totalHours = matters.reduce((s, m) => s + m.totalHours, 0);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Revenue Per Matter</h3>
        <p className="text-sm text-muted-foreground mt-0.5">Track billed and collected revenue across all active matters</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Billed', value: fmt(totalRevenue), icon: 'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' },
          { label: 'Total Collected', value: fmt(totalCollected), icon: 'M22 11.08V12a10 10 0 1 1-5.93-9.14' },
          { label: 'Total Hours', value: `${totalHours.toFixed(1)} hrs`, icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#355E3B20' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={kpi.icon}/>
                </svg>
              </div>
              <span className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">{kpi.label}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          type="text"
          placeholder="Search by client or service…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
        />
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-20 bg-muted/30 rounded-2xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <p className="text-muted-foreground text-sm">{search ? 'No matters match your search.' : 'No matter revenue data yet. Generate invoices linked to matters to see revenue here.'}</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40">
                <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Matter / Client</th>
                <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden sm:table-cell">Service</th>
                <th className="text-right px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Billed</th>
                <th className="text-right px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden md:table-cell">Collected</th>
                <th className="text-right px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden lg:table-cell">Hours</th>
                <th className="text-right px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden md:table-cell">Invoices</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, i) => {
                const outstanding = m.totalBilled - m.totalPaid;
                const pct = m.totalBilled > 0 ? (m.totalPaid / m.totalBilled) * 100 : 0;
                return (
                  <tr key={m.inquiryId} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                    <td className="px-5 py-4">
                      <p className="font-medium text-foreground">{m.matterName}</p>
                      {outstanding > 0 && (
                        <p className="text-xs text-amber-600 mt-0.5">{fmt(outstanding)} outstanding</p>
                      )}
                      <div className="mt-1.5 h-1.5 bg-muted/30 rounded-full overflow-hidden w-24">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: '#355E3B' }} />
                      </div>
                    </td>
                    <td className="px-5 py-4 text-muted-foreground hidden sm:table-cell">{m.service}</td>
                    <td className="px-5 py-4 text-right font-semibold text-foreground">{fmt(m.totalBilled)}</td>
                    <td className="px-5 py-4 text-right text-emerald-700 hidden md:table-cell">{fmt(m.totalPaid)}</td>
                    <td className="px-5 py-4 text-right text-muted-foreground hidden lg:table-cell">{m.totalHours.toFixed(1)}</td>
                    <td className="px-5 py-4 text-right text-muted-foreground hidden md:table-cell">{m.invoiceCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Sub-tab: Payment History ─────────────────────────────────────────────────

function PaymentHistoryPanel() {
  const supabase = createClient();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('client_invoices')
      .select('id, invoice_number, invoice_date, due_date, amount, amount_paid, status, notes, inquiry_id, payment_type, created_at, contact_inquiries(name, email, service)')
      .order('created_at', { ascending: false })
      .limit(200);
    setInvoices(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  async function markPaid(id: string, amount: number) {
    setUpdatingId(id);
    await supabase.from('client_invoices').update({ status: 'paid', amount_paid: amount }).eq('id', id);
    fetchInvoices();
    setUpdatingId(null);
  }

  const filtered = invoices.filter(inv => {
    const inq = inv.contact_inquiries as { name: string; email: string; service: string } | null;
    const matchSearch = !search ||
      inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
      (inq?.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (inq?.email ?? '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.amount_paid), 0);
  const totalPending = invoices.filter(i => i.status === 'pending').reduce((s, i) => s + Number(i.amount), 0);
  const totalOverdue = invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + Number(i.amount), 0);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Payment History</h3>
        <p className="text-sm text-muted-foreground mt-0.5">All invoices and payment records across all clients</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Collected', value: fmt(totalPaid), color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
          { label: 'Pending', value: fmt(totalPending), color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
          { label: 'Overdue', value: fmt(totalOverdue), color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
        ].map(kpi => (
          <div key={kpi.label} className={`border rounded-2xl p-4 ${kpi.bg}`}>
            <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground mb-1">{kpi.label}</p>
            <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search invoice, client, email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all appearance-none min-w-[140px]"
        >
          <option value="all">All Statuses</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="overdue">Overdue</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button onClick={fetchInvoices} className="px-4 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm font-medium hover:border-accent/50 transition-all flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
          </svg>
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-muted/30 rounded-2xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <p className="text-muted-foreground text-sm">{search || statusFilter !== 'all' ? 'No invoices match your filters.' : 'No invoices yet.'}</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/40">
                  <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Invoice</th>
                  <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden sm:table-cell">Client</th>
                  <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden md:table-cell">Date</th>
                  <th className="text-right px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Amount</th>
                  <th className="text-right px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden md:table-cell">Paid</th>
                  <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Status</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv, i) => {
                  const inq = inv.contact_inquiries as { name: string; email: string; service: string } | null;
                  return (
                    <tr key={inv.id} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-foreground">{inv.invoice_number}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{inv.payment_type ?? 'general'}</p>
                      </td>
                      <td className="px-5 py-3.5 hidden sm:table-cell">
                        <p className="text-foreground/80">{inq?.name ?? '—'}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{inq?.service ?? ''}</p>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground hidden md:table-cell">
                        <p>{fmtDate(inv.invoice_date)}</p>
                        <p className="text-xs mt-0.5">Due {fmtDate(inv.due_date)}</p>
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold text-foreground">{fmt(Number(inv.amount))}</td>
                      <td className="px-5 py-3.5 text-right text-emerald-700 hidden md:table-cell">{fmt(Number(inv.amount_paid))}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_COLORS[inv.status] ?? STATUS_COLORS['pending']}`}>
                          {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {inv.status === 'pending' && (
                          <button
                            onClick={() => markPaid(inv.id, Number(inv.amount))}
                            disabled={updatingId === inv.id}
                            className="text-xs px-2.5 py-1.5 rounded-lg font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
                            style={{ background: '#355E3B' }}
                          >
                            {updatingId === inv.id ? '…' : 'Mark Paid'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-border bg-secondary/20 text-xs text-muted-foreground">
            Showing {filtered.length} of {invoices.length} invoices
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const SUB_TABS: { id: BillingSubTab; label: string; icon: string }[] = [
  { id: 'rates', label: 'Hourly Rates', icon: 'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' },
  { id: 'generate', label: 'Generate Invoice', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' },
  { id: 'revenue', label: 'Revenue by Matter', icon: 'M18 20V10M12 20V4M6 20v-6' },
  { id: 'history', label: 'Payment History', icon: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2' },
];

export default function AdminBillingTab() {
  const [activeSubTab, setActiveSubTab] = useState<BillingSubTab>('rates');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: '#355E3B20' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M7 15h.01"/><path d="M11 15h2"/>
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Billing</h2>
          <p className="text-sm text-muted-foreground">Manage rates, generate invoices, and track revenue</p>
        </div>
      </div>

      {/* Sub-tab nav */}
      <div className="flex flex-wrap gap-1 p-1 bg-secondary/40 rounded-2xl border border-border">
        {SUB_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeSubTab === tab.id
                ? 'bg-card text-foreground shadow-sm border border-border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={tab.icon}/>
            </svg>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      <div>
        {activeSubTab === 'rates' && <HourlyRatesPanel />}
        {activeSubTab === 'generate' && <GenerateInvoicePanel />}
        {activeSubTab === 'revenue' && <RevenuePerMatterPanel />}
        {activeSubTab === 'history' && <PaymentHistoryPanel />}
      </div>
    </div>
  );
}
