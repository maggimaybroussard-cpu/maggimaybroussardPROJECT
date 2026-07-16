'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface CaseCloseRequest {
  id: string;
  token: string;
  client_name: string;
  client_email: string;
  service: string | null;
  case_reference: string | null;
  review_submitted: boolean;
  review_submitted_at: string | null;
  rating: number | null;
  review_quote: string | null;
  review_full_quote: string | null;
  reviewer_role: string | null;
  reviewer_firm: string | null;
  reviewer_location: string | null;
  allow_public_display: boolean;
  testimonial_status: 'pending' | 'approved' | 'rejected';
  testimonial_approved_at: string | null;
  testimonial_id: string | null;
  referral_incentive_sent: boolean;
  referral_code: string | null;
  referral_reward_desc: string | null;
  admin_notes: string | null;
  created_at: string;
}

interface ReferralSubmission {
  id: string;
  case_close_id: string;
  referral_code: string | null;
  referred_name: string;
  referred_email: string;
  referred_firm: string | null;
  referred_service: string | null;
  message: string | null;
  status: 'pending' | 'contacted' | 'converted' | 'declined';
  admin_notes: string | null;
  created_at: string;
  case_close_requests?: { client_name: string; client_email: string } | null;
}

type ActiveView = 'requests' | 'referrals';

const SERVICES = [
  'Legal Research', 'Document Drafting', 'Litigation Support',
  'Contract Review', 'Case Management', 'Other',
];

export default function PostCaseCloseFlowDashboard() {
  const supabase = createClient();
  const [activeView, setActiveView] = useState<ActiveView>('requests');
  const [requests, setRequests] = useState<CaseCloseRequest[]>([]);
  const [referrals, setReferrals] = useState<ReferralSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'not_submitted'>('all');
  const [search, setSearch] = useState('');

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    client_name: '', client_email: '', service: '', case_reference: '', referral_reward_desc: '$50 credit toward future services',
  });
  const [createError, setCreateError] = useState('');
  const [createdLink, setCreatedLink] = useState('');

  // Detail modal
  const [selectedRequest, setSelectedRequest] = useState<CaseCloseRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [reqResult, refResult] = await Promise.all([
      supabase.from('case_close_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('referral_submissions').select('*, case_close_requests(client_name, client_email)').order('created_at', { ascending: false }),
    ]);
    const reqData = reqResult.data;
    const refData = refResult.data;
    setRequests(reqData ?? []);
    setReferrals(refData ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredRequests = requests.filter((r) => {
    const matchSearch = !search ||
      r.client_name.toLowerCase().includes(search.toLowerCase()) ||
      r.client_email.toLowerCase().includes(search.toLowerCase()) ||
      (r.case_reference ?? '').toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (filterStatus === 'all') return true;
    if (filterStatus === 'not_submitted') return !r.review_submitted;
    if (filterStatus === 'pending') return r.review_submitted && r.testimonial_status === 'pending';
    if (filterStatus === 'approved') return r.testimonial_status === 'approved';
    if (filterStatus === 'rejected') return r.testimonial_status === 'rejected';
    return true;
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.client_name.trim() || !createForm.client_email.trim()) {
      setCreateError('Client name and email are required.');
      return;
    }
    setCreateError('');
    setCreating(true);
    const { data, error } = await supabase
      .from('case_close_requests')
      .insert({
        client_name: createForm.client_name.trim(),
        client_email: createForm.client_email.trim(),
        service: createForm.service.trim() || null,
        case_reference: createForm.case_reference.trim() || null,
        referral_reward_desc: createForm.referral_reward_desc.trim() || '$50 credit toward future services',
      })
      .select('token')
      .single();
    setCreating(false);
    if (error || !data) { setCreateError(error?.message ?? 'Failed to create.'); return; }
    const link = `${window.location.origin}/case-close/${data.token}`;
    setCreatedLink(link);
    fetchData();
  };

  const handleApprove = async (req: CaseCloseRequest) => {
    setApprovingId(req.id);
    // Approve the case_close_request
    await supabase.from('case_close_requests').update({
      testimonial_status: 'approved',
      testimonial_approved_at: new Date().toISOString(),
    }).eq('id', req.id);

    // Activate the testimonial row if it exists
    if (req.testimonial_id) {
      await supabase.from('testimonials').update({ active: true }).eq('id', req.testimonial_id);
    }
    setApprovingId(null);
    fetchData();
    if (selectedRequest?.id === req.id) {
      setSelectedRequest({ ...req, testimonial_status: 'approved', testimonial_approved_at: new Date().toISOString() });
    }
  };

  const handleReject = async (req: CaseCloseRequest) => {
    setApprovingId(req.id);
    await supabase.from('case_close_requests').update({ testimonial_status: 'rejected' }).eq('id', req.id);
    if (req.testimonial_id) {
      await supabase.from('testimonials').update({ active: false }).eq('id', req.testimonial_id);
    }
    setApprovingId(null);
    fetchData();
    if (selectedRequest?.id === req.id) {
      setSelectedRequest({ ...req, testimonial_status: 'rejected' });
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedRequest) return;
    setSavingNotes(true);
    await supabase.from('case_close_requests').update({ admin_notes: adminNotes }).eq('id', selectedRequest.id);
    setSavingNotes(false);
    fetchData();
  };

  const handleReferralStatus = async (id: string, status: ReferralSubmission['status']) => {
    await supabase.from('referral_submissions').update({ status }).eq('id', id);
    fetchData();
  };

  const stats = {
    total: requests.length,
    submitted: requests.filter((r) => r.review_submitted).length,
    pendingApproval: requests.filter((r) => r.review_submitted && r.testimonial_status === 'pending').length,
    approved: requests.filter((r) => r.testimonial_status === 'approved').length,
    referrals: referrals.length,
    referralConverted: referrals.filter((r) => r.status === 'converted').length,
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      contacted: 'bg-blue-100 text-blue-800',
      converted: 'bg-emerald-100 text-emerald-800',
      declined: 'bg-gray-100 text-gray-600',
    };
    return map[status] ?? 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Post-Case-Close Flow</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Send review requests, approve testimonials, and manage referral incentives</p>
        </div>
        <button onClick={() => { setShowCreate(true); setCreatedLink(''); setCreateForm({ client_name: '', client_email: '', service: '', case_reference: '', referral_reward_desc: '$50 credit toward future services' }); }}
          className="inline-flex items-center gap-2 bg-[#C8965A] hover:bg-[#b07d45] text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Send Case Close Request
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Sent', value: stats.total, color: 'text-foreground' },
          { label: 'Reviews In', value: stats.submitted, color: 'text-blue-600' },
          { label: 'Pending Approval', value: stats.pendingApproval, color: 'text-yellow-600' },
          { label: 'Approved', value: stats.approved, color: 'text-green-600' },
          { label: 'Referrals', value: stats.referrals, color: 'text-purple-600' },
          { label: 'Converted', value: stats.referralConverted, color: 'text-emerald-600' },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* View Toggle */}
      <div className="flex gap-2 border-b border-border">
        {(['requests', 'referrals'] as ActiveView[]).map((v) => (
          <button key={v} onClick={() => setActiveView(v)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${activeView === v ? 'border-[#C8965A] text-[#C8965A]' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {v === 'requests' ? `Review Requests (${requests.length})` : `Referrals (${referrals.length})`}
          </button>
        ))}
      </div>

      {/* Requests View */}
      {activeView === 'requests' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, or case reference…"
              className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:border-[#C8965A]" />
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
              className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:border-[#C8965A]">
              <option value="all">All Statuses</option>
              <option value="not_submitted">Not Yet Submitted</option>
              <option value="pending">Pending Approval</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-[#C8965A] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">No requests found.</div>
          ) : (
            <div className="space-y-3">
              {filteredRequests.map((req) => (
                <div key={req.id} className="bg-card border border-border rounded-xl p-5 hover:border-[#C8965A]/40 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-foreground text-sm">{req.client_name}</p>
                        {req.case_reference && (
                          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{req.case_reference}</span>
                        )}
                        {req.service && (
                          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{req.service}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{req.client_email}</p>
                      {req.review_submitted && req.review_quote && (
                        <p className="text-sm text-foreground mt-2 italic">&ldquo;{req.review_quote}&rdquo;</p>
                      )}
                      {req.review_submitted && req.rating && (
                        <div className="flex items-center gap-1 mt-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <span key={i} className={`text-sm ${i < (req.rating ?? 0) ? 'text-[#C8965A]' : 'text-gray-300'}`}>★</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {!req.review_submitted ? (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium">Awaiting Submission</span>
                      ) : (
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${statusBadge(req.testimonial_status)}`}>
                          {req.testimonial_status}
                        </span>
                      )}
                      {req.referral_incentive_sent && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2.5 py-1 rounded-full font-medium">Referral Sent</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-4 flex-wrap">
                    {/* Copy link */}
                    <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/case-close/${req.token}`); }}
                      className="inline-flex items-center gap-1.5 text-xs border border-border text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg transition-colors">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                      </svg>
                      Copy Link
                    </button>

                    {/* Approve / Reject */}
                    {req.review_submitted && req.allow_public_display && req.testimonial_status === 'pending' && (
                      <>
                        <button onClick={() => handleApprove(req)} disabled={approvingId === req.id}
                          className="inline-flex items-center gap-1.5 text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6 9 17l-5-5"/>
                          </svg>
                          Approve Testimonial
                        </button>
                        <button onClick={() => handleReject(req)} disabled={approvingId === req.id}
                          className="inline-flex items-center gap-1.5 text-xs bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                          Reject
                        </button>
                      </>
                    )}
                    {req.review_submitted && req.testimonial_status === 'approved' && (
                      <button onClick={() => handleReject(req)} disabled={approvingId === req.id}
                        className="inline-flex items-center gap-1.5 text-xs bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60">
                        Revoke Approval
                      </button>
                    )}

                    {/* View details */}
                    <button onClick={() => { setSelectedRequest(req); setAdminNotes(req.admin_notes ?? ''); }}
                      className="inline-flex items-center gap-1.5 text-xs border border-[#C8965A]/40 text-[#C8965A] hover:bg-[#F5EDE0] px-3 py-1.5 rounded-lg transition-colors ml-auto">
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Referrals View */}
      {activeView === 'referrals' && (
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-[#C8965A] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : referrals.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">No referrals submitted yet.</div>
          ) : (
            referrals.map((ref) => (
              <div key={ref.id} className="bg-card border border-border rounded-xl p-5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-foreground text-sm">{ref.referred_name}</p>
                      {ref.referred_firm && <span className="text-xs text-muted-foreground">{ref.referred_firm}</span>}
                      {ref.referred_service && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{ref.referred_service}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{ref.referred_email}</p>
                    {ref.case_close_requests && (
                      <p className="text-xs text-muted-foreground mt-1">Referred by: <span className="font-medium text-foreground">{ref.case_close_requests.client_name}</span></p>
                    )}
                    {ref.message && <p className="text-sm text-foreground mt-2 italic">&ldquo;{ref.message}&rdquo;</p>}
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize self-start ${statusBadge(ref.status)}`}>{ref.status}</span>
                </div>
                <div className="flex items-center gap-2 mt-4 flex-wrap">
                  {(['pending', 'contacted', 'converted', 'declined'] as ReferralSubmission['status'][]).map((s) => (
                    <button key={s} onClick={() => handleReferralStatus(ref.id, s)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors capitalize ${ref.status === s ? 'bg-[#C8965A] text-white border-[#C8965A]' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-border">
              <h3 className="font-semibold text-foreground">Send Case Close Request</h3>
              <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {createdLink ? (
              <div className="px-6 py-6 space-y-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5"/>
                  </svg>
                </div>
                <p className="text-center font-semibold text-foreground">Request Created!</p>
                <p className="text-sm text-muted-foreground text-center">Copy and send this link to your client:</p>
                <div className="bg-muted rounded-lg px-4 py-3 flex items-center gap-2">
                  <p className="text-xs text-foreground font-mono flex-1 break-all">{createdLink}</p>
                  <button onClick={() => navigator.clipboard.writeText(createdLink)}
                    className="shrink-0 text-[#C8965A] hover:text-[#b07d45]">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                  </button>
                </div>
                <button onClick={() => { setShowCreate(false); setCreatedLink(''); }}
                  className="w-full bg-[#C8965A] hover:bg-[#b07d45] text-white text-sm font-semibold py-3 rounded-lg transition-colors">
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-foreground uppercase tracking-wide mb-1.5">Client Name <span className="text-[#C8965A]">*</span></label>
                    <input type="text" value={createForm.client_name} onChange={(e) => setCreateForm((f) => ({ ...f, client_name: e.target.value }))}
                      placeholder="Full name" required
                      className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background text-foreground focus:outline-none focus:border-[#C8965A]" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-foreground uppercase tracking-wide mb-1.5">Client Email <span className="text-[#C8965A]">*</span></label>
                    <input type="email" value={createForm.client_email} onChange={(e) => setCreateForm((f) => ({ ...f, client_email: e.target.value }))}
                      placeholder="email@example.com" required
                      className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background text-foreground focus:outline-none focus:border-[#C8965A]" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-foreground uppercase tracking-wide mb-1.5">Service</label>
                    <select value={createForm.service} onChange={(e) => setCreateForm((f) => ({ ...f, service: e.target.value }))}
                      className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background text-foreground focus:outline-none focus:border-[#C8965A]">
                      <option value="">Select…</option>
                      {SERVICES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-foreground uppercase tracking-wide mb-1.5">Case Reference</label>
                    <input type="text" value={createForm.case_reference} onChange={(e) => setCreateForm((f) => ({ ...f, case_reference: e.target.value }))}
                      placeholder="e.g. CASE-2026-001"
                      className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background text-foreground focus:outline-none focus:border-[#C8965A]" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground uppercase tracking-wide mb-1.5">Referral Reward Description</label>
                  <input type="text" value={createForm.referral_reward_desc} onChange={(e) => setCreateForm((f) => ({ ...f, referral_reward_desc: e.target.value }))}
                    className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background text-foreground focus:outline-none focus:border-[#C8965A]" />
                </div>
                {createError && <p className="text-sm text-red-600">{createError}</p>}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowCreate(false)}
                    className="flex-1 border border-border text-muted-foreground hover:text-foreground text-sm py-2.5 rounded-lg transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={creating}
                    className="flex-1 bg-[#C8965A] hover:bg-[#b07d45] disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
                    {creating ? 'Creating…' : 'Create & Get Link'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-border">
              <h3 className="font-semibold text-foreground">{selectedRequest.client_name}</h3>
              <button onClick={() => setSelectedRequest(null)} className="text-muted-foreground hover:text-foreground">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-5">
              {/* Info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Email</p><p className="text-foreground">{selectedRequest.client_email}</p></div>
                <div><p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Service</p><p className="text-foreground">{selectedRequest.service ?? '—'}</p></div>
                <div><p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Case Ref</p><p className="text-foreground">{selectedRequest.case_reference ?? '—'}</p></div>
                <div><p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Status</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${statusBadge(selectedRequest.testimonial_status)}`}>{selectedRequest.testimonial_status}</span>
                </div>
              </div>

              {/* Review content */}
              {selectedRequest.review_submitted && (
                <div className="bg-muted rounded-xl p-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Submitted Review</p>
                  {selectedRequest.rating && (
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <span key={i} className={`text-base ${i < (selectedRequest.rating ?? 0) ? 'text-[#C8965A]' : 'text-gray-300'}`}>★</span>
                      ))}
                    </div>
                  )}
                  {selectedRequest.review_quote && <p className="text-sm text-foreground italic">&ldquo;{selectedRequest.review_quote}&rdquo;</p>}
                  {selectedRequest.review_full_quote && selectedRequest.review_full_quote !== selectedRequest.review_quote && (
                    <p className="text-sm text-muted-foreground">{selectedRequest.review_full_quote}</p>
                  )}
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    {selectedRequest.reviewer_role && <span>{selectedRequest.reviewer_role}</span>}
                    {selectedRequest.reviewer_firm && <span>{selectedRequest.reviewer_firm}</span>}
                    {selectedRequest.reviewer_location && <span>{selectedRequest.reviewer_location}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">Public display: {selectedRequest.allow_public_display ? 'Yes' : 'No'}</p>
                </div>
              )}

              {/* Approval actions */}
              {selectedRequest.review_submitted && selectedRequest.allow_public_display && selectedRequest.testimonial_status === 'pending' && (
                <div className="flex gap-3">
                  <button onClick={() => handleApprove(selectedRequest)} disabled={approvingId === selectedRequest.id}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60">
                    ✓ Approve & Publish
                  </button>
                  <button onClick={() => handleReject(selectedRequest)} disabled={approvingId === selectedRequest.id}
                    className="flex-1 bg-red-100 hover:bg-red-200 text-red-700 text-sm font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60">
                    ✕ Reject
                  </button>
                </div>
              )}

              {/* Admin notes */}
              <div>
                <label className="block text-xs font-semibold text-foreground uppercase tracking-wide mb-1.5">Admin Notes</label>
                <textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} rows={3}
                  placeholder="Internal notes about this client or case close…"
                  className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background text-foreground focus:outline-none focus:border-[#C8965A] resize-none" />
                <button onClick={handleSaveNotes} disabled={savingNotes}
                  className="mt-2 text-xs bg-[#C8965A] hover:bg-[#b07d45] disabled:opacity-60 text-white px-4 py-1.5 rounded-lg transition-colors">
                  {savingNotes ? 'Saving…' : 'Save Notes'}
                </button>
              </div>

              {/* Copy link */}
              <div>
                <label className="block text-xs font-semibold text-foreground uppercase tracking-wide mb-1.5">Client Link</label>
                <div className="bg-muted rounded-lg px-3 py-2.5 flex items-center gap-2">
                  <p className="text-xs font-mono text-foreground flex-1 break-all">{`${typeof window !== 'undefined' ? window.location.origin : ''}/case-close/${selectedRequest.token}`}</p>
                  <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/case-close/${selectedRequest.token}`)}
                    className="shrink-0 text-[#C8965A] hover:text-[#b07d45]">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
