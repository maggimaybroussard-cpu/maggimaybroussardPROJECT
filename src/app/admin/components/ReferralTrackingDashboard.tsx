'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReferralLog {
  id: string;
  referrer_name: string | null;
  referrer_email: string | null;
  referred_name: string | null;
  referred_email: string | null;
  referral_source: string | null;
  booking_completed: boolean;
  reward_issued: boolean;
  created_at: string;
}

interface ReferralStats {
  total: number;
  bookingCompleted: number;
  rewardsIssued: number;
  conversionRate: number;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ReferralTrackingDashboard() {
  const [logs, setLogs] = useState<ReferralLog[]>([]);
  const [stats, setStats] = useState<ReferralStats>({ total: 0, bookingCompleted: 0, rewardsIssued: 0, conversionRate: 0 });
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({
    referrer_name: '',
    referrer_email: '',
    referred_name: '',
    referred_email: '',
    referral_source: 'client_referral',
  });
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('referral_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    const logs = data ?? [];
    setLogs(logs);
    const bookingCompleted = logs.filter((l) => l.booking_completed).length;
    const rewardsIssued = logs.filter((l) => l.reward_issued).length;
    setStats({
      total: logs.length,
      bookingCompleted,
      rewardsIssued,
      conversionRate: logs.length > 0 ? Math.round((bookingCompleted / logs.length) * 100) : 0,
    });
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.referrer_name.trim() || !form.referred_name.trim()) return;
    setSaving(true);
    await supabase.from('referral_logs').insert({
      referrer_name: form.referrer_name.trim(),
      referrer_email: form.referrer_email.trim() || null,
      referred_name: form.referred_name.trim(),
      referred_email: form.referred_email.trim() || null,
      referral_source: form.referral_source,
    });
    setForm({ referrer_name: '', referrer_email: '', referred_name: '', referred_email: '', referral_source: 'client_referral' });
    setShowAddForm(false);
    setSaving(false);
    await loadData();
  };

  const toggleBooking = async (id: string, current: boolean) => {
    await supabase.from('referral_logs').update({ booking_completed: !current }).eq('id', id);
    setLogs((prev) => prev.map((l) => l.id === id ? { ...l, booking_completed: !current } : l));
  };

  const toggleReward = async (id: string, current: boolean) => {
    await supabase.from('referral_logs').update({ reward_issued: !current }).eq('id', id);
    setLogs((prev) => prev.map((l) => l.id === id ? { ...l, reward_issued: !current } : l));
  };

  const sourceLabel = (source: string | null) => {
    switch (source) {
      case 'client_referral': return { label: 'Client Referral', color: '#355E3B', bg: '#F0FDF4' };
      case 'attorney_referral': return { label: 'Attorney Referral', color: '#1d4ed8', bg: '#EFF6FF' };
      case 'online': return { label: 'Online', color: '#7c3aed', bg: '#F5F3FF' };
      default: return { label: source ?? 'Direct', color: '#6B7280', bg: '#F3F4F6' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Referral Tracking</h3>
          <p className="text-sm text-slate-500">Log referring clients and track referral conversions</p>
        </div>
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: '#355E3B' }}
        >
          + Log Referral
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Referrals', value: stats.total, icon: '👥' },
          { label: 'Bookings Made', value: stats.bookingCompleted, icon: '📅' },
          { label: 'Rewards Issued', value: stats.rewardsIssued, icon: '🎁' },
          { label: 'Conversion Rate', value: `${stats.conversionRate}%`, icon: '📈' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border bg-white p-4" style={{ borderColor: '#E5E7EB' }}>
            <p className="text-2xl mb-1">{stat.icon}</p>
            <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
            <p className="text-xs text-slate-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Add form */}
      {showAddForm && (
        <form onSubmit={handleAdd} className="rounded-xl border bg-white p-5 space-y-4" style={{ borderColor: '#D9D0C5' }}>
          <h4 className="font-semibold text-slate-900">Log New Referral</h4>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1 text-slate-600">Referring Client *</label>
              <input type="text" value={form.referrer_name} onChange={(e) => setForm((f) => ({ ...f, referrer_name: e.target.value }))} placeholder="Name" className="w-full text-sm px-3 py-2 rounded-lg border outline-none" style={{ borderColor: '#D9D0C5' }} required />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-slate-600">Referrer Email</label>
              <input type="email" value={form.referrer_email} onChange={(e) => setForm((f) => ({ ...f, referrer_email: e.target.value }))} placeholder="Email" className="w-full text-sm px-3 py-2 rounded-lg border outline-none" style={{ borderColor: '#D9D0C5' }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-slate-600">Referred Client *</label>
              <input type="text" value={form.referred_name} onChange={(e) => setForm((f) => ({ ...f, referred_name: e.target.value }))} placeholder="Name" className="w-full text-sm px-3 py-2 rounded-lg border outline-none" style={{ borderColor: '#D9D0C5' }} required />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-slate-600">Referred Email</label>
              <input type="email" value={form.referred_email} onChange={(e) => setForm((f) => ({ ...f, referred_email: e.target.value }))} placeholder="Email" className="w-full text-sm px-3 py-2 rounded-lg border outline-none" style={{ borderColor: '#D9D0C5' }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-slate-600">Source</label>
              <select value={form.referral_source} onChange={(e) => setForm((f) => ({ ...f, referral_source: e.target.value }))} className="w-full text-sm px-3 py-2 rounded-lg border outline-none" style={{ borderColor: '#D9D0C5' }}>
                <option value="client_referral">Client Referral</option>
                <option value="attorney_referral">Attorney Referral</option>
                <option value="online">Online</option>
                <option value="direct">Direct</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: '#355E3B' }}>
              {saving ? 'Saving…' : 'Save Referral'}
            </button>
            <button type="button" onClick={() => setShowAddForm(false)} className="px-5 py-2 rounded-xl text-sm border" style={{ borderColor: '#D9D0C5', color: '#4A3728' }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Logs table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <span className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#4A3728' }} />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <p className="text-4xl mb-3">👥</p>
          <p className="font-medium">No referrals logged yet</p>
          <p className="text-sm">Click &quot;Log Referral&quot; to add the first one</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => {
            const src = sourceLabel(log.referral_source);
            return (
              <div key={log.id} className="rounded-xl border bg-white p-4" style={{ borderColor: '#E5E7EB' }}>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-slate-900">{log.referrer_name}</span>
                      <span className="text-slate-400 text-sm">→</span>
                      <span className="font-semibold text-slate-900">{log.referred_name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: src.bg, color: src.color }}>
                        {src.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">{new Date(log.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleBooking(log.id, log.booking_completed)}
                      className="text-xs px-3 py-1.5 rounded-lg border transition-all"
                      style={{
                        borderColor: log.booking_completed ? '#BBF7D0' : '#D9D0C5',
                        background: log.booking_completed ? '#F0FDF4' : 'white',
                        color: log.booking_completed ? '#166534' : '#6B7280',
                      }}
                    >
                      {log.booking_completed ? '✓ Booked' : '○ Booking'}
                    </button>
                    <button
                      onClick={() => toggleReward(log.id, log.reward_issued)}
                      className="text-xs px-3 py-1.5 rounded-lg border transition-all"
                      style={{
                        borderColor: log.reward_issued ? '#FDE68A' : '#D9D0C5',
                        background: log.reward_issued ? '#FFFBEB' : 'white',
                        color: log.reward_issued ? '#92400E' : '#6B7280',
                      }}
                    >
                      {log.reward_issued ? '🎁 Rewarded' : '○ Reward'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
