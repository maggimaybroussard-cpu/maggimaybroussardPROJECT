'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface ReferralStat {
  name: string;
  count: number;
  converted: number;
}

interface ReferralRecord {
  id: string;
  referred_by_name: string | null;
  new_client_name: string;
  new_client_email: string;
  status: string;
  source_note: string | null;
  created_at: string;
}

interface Analytics {
  total: number;
  converted: number;
  pending: number;
  by_referrer: ReferralStat[];
  recent: ReferralRecord[];
}

export default function ReferralTrackingDashboard() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ referred_by_name: '', new_client_name: '', new_client_email: '', source_note: '' });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/referrals/track');
      const data = await res.json();
      setAnalytics(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.new_client_name || !form.new_client_email) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/referrals/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setSuccess('Referral logged successfully!');
        setForm({ referred_by_name: '', new_client_name: '', new_client_email: '', source_note: '' });
        setShowAddForm(false);
        load();
      }
    } catch {
      // silently fail
    } finally {
      setSubmitting(false);
    }
  };

  const conversionRate = analytics && analytics.total > 0
    ? Math.round((analytics.converted / analytics.total) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Referral Tracking</h3>
          <p className="text-sm text-slate-500">Track which clients refer others and monitor conversion rates</p>
        </div>
        <button
          onClick={() => setShowAddForm(v => !v)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#1b2a4a] text-white rounded-xl text-sm font-semibold hover:bg-[#1b2a4a]/90 transition-colors"
        >
          + Log Referral
        </button>
      </div>

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700">{success}</div>
      )}

      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <h4 className="font-semibold text-slate-900">Log New Referral</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Referred By (existing client)</label>
              <input
                type="text"
                value={form.referred_by_name}
                onChange={e => setForm(f => ({ ...f, referred_by_name: e.target.value }))}
                placeholder="Client name"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">New Client Name *</label>
              <input
                type="text"
                value={form.new_client_name}
                onChange={e => setForm(f => ({ ...f, new_client_name: e.target.value }))}
                placeholder="New client name"
                required
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">New Client Email *</label>
              <input
                type="email"
                value={form.new_client_email}
                onChange={e => setForm(f => ({ ...f, new_client_email: e.target.value }))}
                placeholder="email@example.com"
                required
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Source Note</label>
              <input
                type="text"
                value={form.source_note}
                onChange={e => setForm(f => ({ ...f, source_note: e.target.value }))}
                placeholder="e.g. Word of mouth, LinkedIn"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={submitting} className="px-5 py-2 bg-[#1b2a4a] text-white rounded-xl text-sm font-semibold disabled:opacity-60">
              {submitting ? 'Saving…' : 'Save Referral'}
            </button>
            <button type="button" onClick={() => setShowAddForm(false)} className="px-5 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm">Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading referral data…</div>
      ) : analytics ? (
        <>
          {/* KPI Strip */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 text-center">
              <div className="text-3xl font-bold text-[#1b2a4a]">{analytics.total}</div>
              <div className="text-xs text-slate-500 mt-1">Total Referrals</div>
            </div>
            <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-5 text-center">
              <div className="text-3xl font-bold text-emerald-700">{analytics.converted}</div>
              <div className="text-xs text-emerald-600 mt-1">Converted</div>
            </div>
            <div className="bg-blue-50 rounded-2xl border border-blue-200 p-5 text-center">
              <div className="text-3xl font-bold text-blue-700">{conversionRate}%</div>
              <div className="text-xs text-blue-600 mt-1">Conversion Rate</div>
            </div>
          </div>

          {/* Top Referrers */}
          {analytics.by_referrer.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h4 className="font-semibold text-slate-900">Top Referrers</h4>
              </div>
              <div className="divide-y divide-slate-100">
                {analytics.by_referrer.slice(0, 10).map((r, i) => (
                  <div key={i} className="px-5 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-full bg-[#1b2a4a]/10 text-[#1b2a4a] text-xs font-bold flex items-center justify-center">{i + 1}</span>
                      <span className="text-sm font-medium text-slate-800">{r.name}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-slate-500">{r.count} referred</span>
                      <span className="text-emerald-600 font-medium">{r.converted} converted</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Referrals */}
          {analytics.recent.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h4 className="font-semibold text-slate-900">Recent Referrals</h4>
              </div>
              <div className="divide-y divide-slate-100">
                {analytics.recent.slice(0, 10).map((r) => (
                  <div key={r.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-slate-800">{r.new_client_name}</div>
                      <div className="text-xs text-slate-500">{r.new_client_email} · Referred by: {r.referred_by_name || 'Unknown'}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      {r.source_note && <span className="text-xs text-slate-400">{r.source_note}</span>}
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                        r.status === 'converted' ? 'bg-emerald-50 text-emerald-700' :
                        r.status === 'pending'? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-600'
                      }`}>{r.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {analytics.total === 0 && (
            <div className="text-center py-12 text-slate-400">
              <div className="text-4xl mb-3">🤝</div>
              <p className="text-sm">No referrals logged yet. Use the button above to log your first referral.</p>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
