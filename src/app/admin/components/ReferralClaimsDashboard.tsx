'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface ReferralClaim {
  id: string;
  case_close_id: string | null;
  referral_code: string;
  claimant_name: string;
  claimant_email: string;
  claimant_phone: string | null;
  referred_by_name: string | null;
  referred_by_email: string | null;
  service_interest: string | null;
  message: string | null;
  claim_status: string;
  incentive_type: string;
  incentive_amount: number;
  incentive_desc: string;
  admin_notes: string | null;
  processed_at: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  paid: 'bg-blue-50 text-blue-700 border-blue-200',
};

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ReferralClaimsDashboard() {
  const supabase = createClient();
  const [claims, setClaims] = useState<ReferralClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [selectedClaim, setSelectedClaim] = useState<ReferralClaim | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('all');

  const fetchClaims = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('referral_claims')
        .select('*')
        .order('created_at', { ascending: false });
      setClaims(data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load claims');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { fetchClaims(); }, [fetchClaims]);

  const updateStatus = async (claim: ReferralClaim, status: string) => {
    setProcessingId(claim.id);
    try {
      await supabase.from('referral_claims').update({
        claim_status: status,
        admin_notes: adminNotes || claim.admin_notes,
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', claim.id);
      setSuccessMsg(`Claim ${status}`);
      setSelectedClaim(null);
      setAdminNotes('');
      await fetchClaims();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update claim');
    } finally {
      setProcessingId(null);
    }
  };

  const filtered = filterStatus === 'all' ? claims : claims.filter(c => c.claim_status === filterStatus);
  const pendingCount = claims.filter(c => c.claim_status === 'pending').length;
  const totalPaid = claims.filter(c => c.claim_status === 'paid').reduce((s, c) => s + c.incentive_amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-6 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ background: '#C8965A' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <div>
              <h2 className="font-serif text-xl text-foreground">Referral Claims</h2>
              <p className="text-xs text-muted-foreground">Manage incentive claims from referred clients</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-border">
          <div className="px-5 py-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Total Claims</p>
            <p className="text-xl font-semibold text-foreground">{claims.length}</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Pending Review</p>
            <p className="text-xl font-semibold text-amber-600">{pendingCount}</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Incentives Paid</p>
            <p className="text-xl font-semibold text-emerald-700">{fmt(totalPaid)}</p>
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          {successMsg}
        </div>
      )}
      {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'pending', 'approved', 'paid', 'rejected'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${filterStatus === s ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground hover:border-foreground/30'}`}>
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            {s === 'pending' && pendingCount > 0 && ` (${pendingCount})`}
          </button>
        ))}
      </div>

      <div className={`grid gap-6 ${selectedClaim ? 'lg:grid-cols-5' : 'grid-cols-1'}`}>
        {/* Claims List */}
        <div className={selectedClaim ? 'lg:col-span-3' : 'col-span-1'}>
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Loading claims…</div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground text-sm">No referral claims found.</div>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map(claim => (
                  <button key={claim.id} onClick={() => { setSelectedClaim(selectedClaim?.id === claim.id ? null : claim); setAdminNotes(claim.admin_notes || ''); }}
                    className={`w-full px-5 py-4 text-left transition-colors hover:bg-secondary/30 ${selectedClaim?.id === claim.id ? 'bg-secondary/40' : ''}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground text-sm">{claim.claimant_name}</p>
                        <p className="text-xs text-muted-foreground">{claim.claimant_email}</p>
                        {claim.referred_by_name && (
                          <p className="text-xs text-muted-foreground/70 mt-0.5">Referred by: {claim.referred_by_name}</p>
                        )}
                        <p className="text-xs text-muted-foreground/60 mt-0.5">Code: {claim.referral_code} · {fmtDate(claim.created_at)}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-semibold text-foreground text-sm">{fmt(claim.incentive_amount)}</p>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLORS[claim.claim_status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                          {claim.claim_status}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Claim Detail */}
        {selectedClaim && (
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-border bg-card p-6 sticky top-28">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-serif text-lg text-foreground">{selectedClaim.claimant_name}</h3>
                  <p className="text-xs text-muted-foreground">{selectedClaim.claimant_email}</p>
                </div>
                <button onClick={() => setSelectedClaim(null)} className="text-muted-foreground/50 hover:text-foreground">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>

              <div className="space-y-3 mb-5">
                {[
                  { label: 'Referral Code', value: selectedClaim.referral_code },
                  { label: 'Phone', value: selectedClaim.claimant_phone || '—' },
                  { label: 'Referred By', value: selectedClaim.referred_by_name || '—' },
                  { label: 'Service Interest', value: selectedClaim.service_interest || '—' },
                  { label: 'Incentive', value: `${fmt(selectedClaim.incentive_amount)} — ${selectedClaim.incentive_desc}` },
                  { label: 'Submitted', value: fmtDate(selectedClaim.created_at) },
                ].map(item => (
                  <div key={item.label} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-medium text-foreground text-right max-w-[60%]">{item.value}</span>
                  </div>
                ))}
              </div>

              {selectedClaim.message && (
                <div className="mb-4 p-3 rounded-xl bg-secondary/30 border border-border">
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-widest mb-1">Message</p>
                  <p className="text-sm text-foreground">{selectedClaim.message}</p>
                </div>
              )}

              <div className="mb-4">
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Admin Notes</label>
                <textarea rows={3} value={adminNotes} onChange={e => setAdminNotes(e.target.value)} placeholder="Internal notes…"
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 resize-none" />
              </div>

              {selectedClaim.claim_status === 'pending' && (
                <div className="flex gap-2">
                  <button onClick={() => updateStatus(selectedClaim, 'approved')} disabled={processingId === selectedClaim.id}
                    className="flex-1 py-2.5 rounded-xl text-white text-xs font-semibold uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-50"
                    style={{ background: '#355E3B' }}>
                    Approve
                  </button>
                  <button onClick={() => updateStatus(selectedClaim, 'rejected')} disabled={processingId === selectedClaim.id}
                    className="flex-1 py-2.5 rounded-xl border border-red-200 text-red-600 text-xs font-semibold uppercase tracking-widest transition-all hover:bg-red-50 disabled:opacity-50">
                    Reject
                  </button>
                </div>
              )}
              {selectedClaim.claim_status === 'approved' && (
                <button onClick={() => updateStatus(selectedClaim, 'paid')} disabled={processingId === selectedClaim.id}
                  className="w-full py-2.5 rounded-xl text-white text-xs font-semibold uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ background: '#C8965A' }}>
                  Mark as Paid
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
