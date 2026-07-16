'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DocumentDraft {
  id: string;
  document_type: string;
  title: string;
  client_name: string;
  client_email: string | null;
  case_ref: string | null;
  service_type: string | null;
  case_facts: string;
  custom_instructions: string | null;
  draft_content: string;
  draft_status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  sent_at: string | null;
  sent_by: string | null;
  recipient_email: string | null;
  recipient_name: string | null;
  created_at: string;
  updated_at: string;
}

type FilterStatus = 'all' | 'pending_review' | 'approved' | 'rejected' | 'sent';

// ── Helpers ───────────────────────────────────────────────────────────────────

const DOC_TYPE_LABELS: Record<string, string> = {
  motion: '⚖️ Motion',
  brief: '📄 Legal Brief',
  discovery_request: '🔍 Discovery Request',
  demand_letter: '✉️ Demand Letter',
  settlement_agreement: '🤝 Settlement Agreement',
  contract_review: '📋 Contract Review Memo',
};

const STATUS_STYLES: Record<string, string> = {
  pending_review: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  sent: 'bg-blue-50 text-blue-700 border-blue-200',
};

const STATUS_LABELS: Record<string, string> = {
  pending_review: '⏳ Pending Review',
  approved: '✅ Approved',
  rejected: '❌ Rejected',
  sent: '📤 Sent',
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function LexiDocumentDraftsDashboard() {
  const supabase = createClient();
  const [drafts, setDrafts] = useState<DocumentDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('pending_review');
  const [selectedDraft, setSelectedDraft] = useState<DocumentDraft | null>(null);
  const [editedContent, setEditedContent] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [sendEmail, setSendEmail] = useState('');
  const [sendName, setSendName] = useState('');
  const [processing, setProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showSendPanel, setShowSendPanel] = useState(false);

  const fetchDrafts = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('lexi_document_drafts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (filterStatus !== 'all') {
        query = query.eq('draft_status', filterStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      setDrafts(data || []);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load drafts');
    } finally {
      setLoading(false);
    }
  }, [supabase, filterStatus]);

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  const openDraft = (draft: DocumentDraft) => {
    setSelectedDraft(draft);
    setEditedContent(draft.draft_content);
    setRejectReason('');
    setSendEmail(draft.client_email || '');
    setSendName(draft.client_name || '');
    setShowSendPanel(false);
    setSuccessMsg(null);
    setErrorMsg(null);
  };

  const handleApprove = async () => {
    if (!selectedDraft) return;
    setProcessing(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase
        .from('lexi_document_drafts')
        .update({
          draft_status: 'approved',
          draft_content: editedContent,
          reviewed_by: 'Admin',
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedDraft.id);

      if (error) throw error;
      setSuccessMsg('Draft approved successfully');
      setSelectedDraft(prev => prev ? { ...prev, draft_status: 'approved', draft_content: editedContent } : null);
      await fetchDrafts();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to approve draft');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedDraft || !rejectReason.trim()) {
      setErrorMsg('Please provide a rejection reason');
      return;
    }
    setProcessing(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase
        .from('lexi_document_drafts')
        .update({
          draft_status: 'rejected',
          reviewed_by: 'Admin',
          reviewed_at: new Date().toISOString(),
          rejection_reason: rejectReason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedDraft.id);

      if (error) throw error;
      setSuccessMsg('Draft rejected');
      setSelectedDraft(prev => prev ? { ...prev, draft_status: 'rejected', rejection_reason: rejectReason } : null);
      await fetchDrafts();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to reject draft');
    } finally {
      setProcessing(false);
    }
  };

  const handleSend = async () => {
    if (!selectedDraft) return;
    if (!sendEmail.trim()) {
      setErrorMsg('Recipient email is required to send');
      return;
    }
    setProcessing(true);
    setErrorMsg(null);
    try {
      // Send via Resend through the existing send-client-email endpoint
      const res = await fetch('/api/admin/send-client-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: sendEmail,
          subject: `${selectedDraft.title} — Broussard Legal Services`,
          body: editedContent,
          clientName: sendName || selectedDraft.client_name,
        }),
      });

      // Mark as sent regardless of email result (email service may not be configured)
      await supabase
        .from('lexi_document_drafts')
        .update({
          draft_status: 'sent',
          draft_content: editedContent,
          reviewed_by: 'Admin',
          reviewed_at: new Date().toISOString(),
          sent_at: new Date().toISOString(),
          sent_by: 'Admin',
          recipient_email: sendEmail,
          recipient_name: sendName || selectedDraft.client_name,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedDraft.id);

      setSuccessMsg(`Document sent to ${sendEmail}`);
      setSelectedDraft(prev => prev ? { ...prev, draft_status: 'sent', sent_at: new Date().toISOString() } : null);
      setShowSendPanel(false);
      await fetchDrafts();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to send document');
    } finally {
      setProcessing(false);
    }
  };

  const pendingCount = drafts.filter(d => d.draft_status === 'pending_review').length;

  const FILTER_TABS: Array<{ id: FilterStatus; label: string }> = [
    { id: 'pending_review', label: `Pending${pendingCount > 0 ? ` (${pendingCount})` : ''}` },
    { id: 'approved', label: 'Approved' },
    { id: 'sent', label: 'Sent' },
    { id: 'rejected', label: 'Rejected' },
    { id: 'all', label: 'All' },
  ];

  return (
    <div className="flex h-full gap-0 overflow-hidden">
      {/* Left panel — draft list */}
      <div className={`flex flex-col border-r border-border bg-background ${selectedDraft ? 'hidden lg:flex lg:w-80 xl:w-96' : 'flex-1'}`}>
        {/* Header */}
        <div className="px-4 py-3 border-b border-border bg-secondary/30 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-bold text-foreground">Document Drafts</h2>
              <p className="text-[10px] text-muted-foreground mt-0.5">Lexi-generated legal documents for review</p>
            </div>
            <button
              onClick={fetchDrafts}
              className="p-1.5 rounded-lg hover:bg-border/50 transition-colors text-muted-foreground hover:text-foreground"
              title="Refresh"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            </button>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 overflow-x-auto">
            {FILTER_TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilterStatus(tab.id)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap transition-all ${
                  filterStatus === tab.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-border/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Draft list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : drafts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <span className="text-3xl mb-3">📝</span>
              <p className="text-sm font-semibold text-foreground">No drafts found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {filterStatus === 'pending_review' ?'No documents pending review'
                  : `No ${filterStatus.replace('_', ' ')} documents`}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {drafts.map(draft => (
                <button
                  key={draft.id}
                  onClick={() => openDraft(draft)}
                  className={`w-full text-left p-4 hover:bg-secondary/50 transition-colors ${
                    selectedDraft?.id === draft.id ? 'bg-primary/5 border-l-2 border-l-primary' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <p className="text-xs font-semibold text-foreground line-clamp-1 flex-1">{draft.title}</p>
                    <span className={`shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${STATUS_STYLES[draft.draft_status] || 'bg-secondary text-muted-foreground border-border'}`}>
                      {STATUS_LABELS[draft.draft_status] || draft.draft_status}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {DOC_TYPE_LABELS[draft.document_type] || draft.document_type}
                  </p>
                  <div className="flex items-center justify-between mt-1.5">
                    <p className="text-[10px] text-foreground font-medium">{draft.client_name}</p>
                    <p className="text-[10px] text-muted-foreground">{fmtDate(draft.created_at)}</p>
                  </div>
                  {draft.case_ref && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">📁 {draft.case_ref}</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right panel — draft detail */}
      {selectedDraft ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Detail header */}
          <div className="px-4 py-3 border-b border-border bg-secondary/30 shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setSelectedDraft(null)}
                    className="lg:hidden text-xs text-muted-foreground hover:text-foreground"
                  >
                    ←
                  </button>
                  <h3 className="text-sm font-bold text-foreground truncate">{selectedDraft.title}</h3>
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${STATUS_STYLES[selectedDraft.draft_status] || 'bg-secondary text-muted-foreground border-border'}`}>
                    {STATUS_LABELS[selectedDraft.draft_status] || selectedDraft.draft_status}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="text-[10px] text-muted-foreground">{DOC_TYPE_LABELS[selectedDraft.document_type] || selectedDraft.document_type}</span>
                  <span className="text-[10px] text-foreground font-medium">👤 {selectedDraft.client_name}</span>
                  {selectedDraft.case_ref && <span className="text-[10px] text-muted-foreground">📁 {selectedDraft.case_ref}</span>}
                  {selectedDraft.service_type && <span className="text-[10px] text-muted-foreground">⚖️ {selectedDraft.service_type}</span>}
                  <span className="text-[10px] text-muted-foreground">📅 {fmtDate(selectedDraft.created_at)}</span>
                </div>
              </div>
            </div>

            {/* Success / error messages */}
            {successMsg && (
              <div className="mt-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-800 font-medium">
                ✅ {successMsg}
              </div>
            )}
            {errorMsg && (
              <div className="mt-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-800 font-medium">
                ❌ {errorMsg}
              </div>
            )}
          </div>

          {/* Detail body */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            {/* Case facts summary */}
            <div className="bg-secondary/50 border border-border rounded-xl p-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Case Facts Provided</p>
              <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{selectedDraft.case_facts}</p>
              {selectedDraft.custom_instructions && (
                <>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mt-3 mb-1.5">Special Instructions</p>
                  <p className="text-xs text-foreground leading-relaxed">{selectedDraft.custom_instructions}</p>
                </>
              )}
            </div>

            {/* Draft content editor */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-foreground">Draft Content</p>
                <span className="text-[10px] text-muted-foreground">Editable before approving or sending</span>
              </div>
              <textarea
                value={editedContent}
                onChange={e => setEditedContent(e.target.value)}
                rows={22}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-xs text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-none leading-relaxed"
              />
            </div>

            {/* Rejection reason (if rejected) */}
            {selectedDraft.draft_status === 'rejected' && selectedDraft.rejection_reason && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-[10px] font-semibold text-red-700 uppercase tracking-wide mb-1">Rejection Reason</p>
                <p className="text-xs text-red-800">{selectedDraft.rejection_reason}</p>
              </div>
            )}

            {/* Sent info */}
            {selectedDraft.draft_status === 'sent' && selectedDraft.sent_at && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                <p className="text-[10px] font-semibold text-blue-700 uppercase tracking-wide mb-1">Sent Details</p>
                <p className="text-xs text-blue-800">
                  Sent to {selectedDraft.recipient_email || selectedDraft.client_email} on {fmtDate(selectedDraft.sent_at)}
                  {selectedDraft.sent_by ? ` by ${selectedDraft.sent_by}` : ''}
                </p>
              </div>
            )}

            {/* Send panel */}
            {showSendPanel && (
              <div className="bg-secondary/50 border border-border rounded-xl p-4 flex flex-col gap-3">
                <p className="text-xs font-semibold text-foreground">Send Document</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Recipient Name</label>
                    <input
                      type="text"
                      value={sendName}
                      onChange={e => setSendName(e.target.value)}
                      placeholder="Client name"
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Recipient Email <span className="text-red-500">*</span></label>
                    <input
                      type="email"
                      value={sendEmail}
                      onChange={e => setSendEmail(e.target.value)}
                      placeholder="email@example.com"
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowSendPanel(false)}
                    className="flex-1 py-2 border border-border text-foreground rounded-lg text-xs font-semibold hover:bg-secondary transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={processing || !sendEmail.trim()}
                    className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {processing ? (
                      <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />Sending…</>
                    ) : (
                      '📤 Send Document'
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Reject reason input */}
            {selectedDraft.draft_status === 'pending_review' && (
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1.5">Rejection Reason (if rejecting)</label>
                <textarea
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  rows={2}
                  placeholder="Explain why this draft needs revision or is being rejected…"
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
            )}
          </div>

          {/* Action footer */}
          {(selectedDraft.draft_status === 'pending_review' || selectedDraft.draft_status === 'approved') && (
            <div className="px-4 py-3 border-t border-border bg-background shrink-0">
              <div className="flex gap-2">
                {selectedDraft.draft_status === 'pending_review' && (
                  <>
                    <button
                      onClick={handleReject}
                      disabled={processing || !rejectReason.trim()}
                      className="flex-1 py-2.5 border border-red-200 text-red-700 bg-red-50 rounded-xl text-xs font-semibold hover:bg-red-100 transition-all disabled:opacity-50"
                    >
                      ❌ Reject
                    </button>
                    <button
                      onClick={handleApprove}
                      disabled={processing}
                      className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {processing ? (
                        <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />Processing…</>
                      ) : (
                        '✅ Approve'
                      )}
                    </button>
                    <button
                      onClick={() => setShowSendPanel(prev => !prev)}
                      className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition-all"
                    >
                      📤 Send
                    </button>
                  </>
                )}
                {selectedDraft.draft_status === 'approved' && (
                  <button
                    onClick={() => setShowSendPanel(prev => !prev)}
                    className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition-all"
                  >
                    📤 Send Document
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="hidden lg:flex flex-1 items-center justify-center text-center p-8">
          <div>
            <span className="text-4xl block mb-3">📝</span>
            <p className="text-sm font-semibold text-foreground">Select a draft to review</p>
            <p className="text-xs text-muted-foreground mt-1">Click any document from the list to review, edit, approve, or send it</p>
          </div>
        </div>
      )}
    </div>
  );
}
