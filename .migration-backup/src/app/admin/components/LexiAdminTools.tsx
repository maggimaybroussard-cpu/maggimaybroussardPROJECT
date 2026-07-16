'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface ConflictCheckResult {
  id: string;
  checked_name: string;
  checked_email: string | null;
  checked_entity: string | null;
  opposing_party: string | null;
  service_type: string | null;
  conflicts_found: ConflictItem[];
  conflict_count: number;
  risk_level: string;
  notes: string | null;
  created_at: string;
}

interface ConflictItem {
  type: string;
  description: string;
  record_id: string;
  record_type: string;
  severity: 'high' | 'medium' | 'low';
}

interface LexiInvoiceDraft {
  id: string;
  client_name: string;
  client_email: string;
  total_hours: number;
  hourly_rate: number;
  subtotal: number;
  line_items: LineItem[];
  notes: string | null;
  draft_status: string;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejection_reason: string | null;
  created_at: string;
  contact_inquiries?: { name: string; service: string } | null;
}

interface LineItem {
  description: string;
  hours: number;
  rate: number;
  total: number;
  work_date?: string;
  work_type?: string;
}

type ActiveView = 'conflict_checker' | 'invoice_drafts';

const RISK_COLORS: Record<string, string> = {
  none: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  low: 'bg-amber-50 text-amber-700 border-amber-200',
  medium: 'bg-orange-50 text-orange-700 border-orange-200',
  high: 'bg-red-50 text-red-700 border-red-200',
};

const STATUS_COLORS: Record<string, string> = {
  pending_approval: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  invoiced: 'bg-blue-50 text-blue-700 border-blue-200',
};

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function LexiAdminTools() {
  const supabase = createClient();
  const [activeView, setActiveView] = useState<ActiveView>('conflict_checker');
  const [conflictChecks, setConflictChecks] = useState<ConflictCheckResult[]>([]);
  const [invoiceDrafts, setInvoiceDrafts] = useState<LexiInvoiceDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Conflict check form
  const [checkForm, setCheckForm] = useState({
    checked_name: '',
    checked_email: '',
    checked_entity: '',
    opposing_party: '',
    service_type: '',
  });
  const [checkResult, setCheckResult] = useState<ConflictCheckResult | null>(null);
  const [checking, setChecking] = useState(false);

  // Invoice draft detail
  const [selectedDraft, setSelectedDraft] = useState<LexiInvoiceDraft | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [checksRes, draftsRes] = await Promise.all([
        supabase.from('conflict_checks').select('*').order('created_at', { ascending: false }).limit(20),
        supabase.from('lexi_invoice_drafts').select('*, contact_inquiries(name, service)').order('created_at', { ascending: false }).limit(50),
      ]);
      setConflictChecks((checksRes.data || []).map(c => ({ ...c, conflicts_found: c.conflicts_found || [] })));
      setInvoiceDrafts(draftsRes.data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runConflictCheck = async () => {
    if (!checkForm.checked_name.trim()) {
      setError('Client name is required for conflict check');
      return;
    }
    setChecking(true);
    setError(null);
    setCheckResult(null);

    try {
      const conflicts: ConflictItem[] = [];
      const name = checkForm.checked_name.toLowerCase();
      const email = checkForm.checked_email.toLowerCase();
      const opposing = checkForm.opposing_party.toLowerCase();

      // Check existing contact_inquiries for name/email matches
      const { data: inquiries } = await supabase
        .from('contact_inquiries')
        .select('id, name, email, service, status')
        .or(email ? `name.ilike.%${name}%,email.ilike.%${email}%` : `name.ilike.%${name}%`)
        .limit(20);

      (inquiries || []).forEach(inq => {
        if (inq.name.toLowerCase().includes(name) || (email && inq.email.toLowerCase().includes(email))) {
          conflicts.push({
            type: 'existing_client',
            description: `Existing inquiry: ${inq.name} (${inq.service}) — Status: ${inq.status}`,
            record_id: inq.id,
            record_type: 'contact_inquiry',
            severity: 'medium',
          });
        }
      });

      // Check opposing party against existing clients
      if (opposing) {
        const { data: oppMatches } = await supabase
          .from('contact_inquiries')
          .select('id, name, email, service')
          .ilike('name', `%${opposing}%`)
          .limit(10);

        (oppMatches || []).forEach(m => {
          conflicts.push({
            type: 'opposing_party_conflict',
            description: `Opposing party "${checkForm.opposing_party}" matches existing client: ${m.name} (${m.service})`,
            record_id: m.id,
            record_type: 'contact_inquiry',
            severity: 'high',
          });
        });
      }

      const highCount = conflicts.filter(c => c.severity === 'high').length;
      const medCount = conflicts.filter(c => c.severity === 'medium').length;
      const riskLevel = highCount > 0 ? 'high' : medCount > 0 ? 'medium' : conflicts.length > 0 ? 'low' : 'none';

      const { data: saved, error: saveErr } = await supabase
        .from('conflict_checks')
        .insert({
          checked_name: checkForm.checked_name,
          checked_email: checkForm.checked_email || null,
          checked_entity: checkForm.checked_entity || null,
          opposing_party: checkForm.opposing_party || null,
          service_type: checkForm.service_type || null,
          conflicts_found: conflicts,
          conflict_count: conflicts.length,
          risk_level: riskLevel,
          checked_by: 'Admin',
        })
        .select()
        .single();

      if (saveErr) throw saveErr;
      setCheckResult({ ...saved, conflicts_found: conflicts });
      await fetchData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Conflict check failed');
    } finally {
      setChecking(false);
    }
  };

  const handleApprove = async (draft: LexiInvoiceDraft) => {
    setProcessingId(draft.id);
    try {
      // Create actual invoice from draft
      const { data: invoice, error: invErr } = await supabase
        .from('client_invoices')
        .insert({
          invoice_number: `LEX-${Date.now().toString().slice(-6)}`,
          invoice_date: new Date().toISOString().split('T')[0],
          due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
          amount: draft.subtotal,
          amount_paid: 0,
          currency: 'usd',
          status: 'draft',
          notes: draft.notes || `Auto-generated from Lexi billable hours — ${draft.total_hours}h @ ${fmt(draft.hourly_rate)}/hr`,
          line_items: draft.line_items,
        })
        .select()
        .single();

      if (invErr) throw invErr;

      await supabase.from('lexi_invoice_drafts').update({
        draft_status: 'approved',
        approved_by: 'Admin',
        approved_at: new Date().toISOString(),
        invoice_id: invoice.id,
        updated_at: new Date().toISOString(),
      }).eq('id', draft.id);

      setSuccessMsg(`Invoice created: ${invoice.invoice_number}`);
      setSelectedDraft(null);
      await fetchData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to approve draft');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (draft: LexiInvoiceDraft) => {
    if (!rejectReason.trim()) {
      setError('Please provide a rejection reason');
      return;
    }
    setProcessingId(draft.id);
    try {
      await supabase.from('lexi_invoice_drafts').update({
        draft_status: 'rejected',
        rejected_by: 'Admin',
        rejected_at: new Date().toISOString(),
        rejection_reason: rejectReason,
        updated_at: new Date().toISOString(),
      }).eq('id', draft.id);

      setSuccessMsg('Draft rejected');
      setSelectedDraft(null);
      setRejectReason('');
      await fetchData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reject draft');
    } finally {
      setProcessingId(null);
    }
  };

  const pendingDrafts = invoiceDrafts.filter(d => d.draft_status === 'pending_approval');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white" style={{ background: '#4A3728' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
            </svg>
          </div>
          <div>
            <h2 className="font-serif text-xl text-foreground">Lexi Admin Tools</h2>
            <p className="text-xs text-muted-foreground">Conflict of Interest Checker · Invoice Draft Approvals</p>
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          {successMsg}
        </div>
      )}
      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* Tab Nav */}
      <div className="flex gap-1 p-1 bg-secondary/40 rounded-xl border border-border w-fit">
        <button onClick={() => setActiveView('conflict_checker')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-widest transition-all ${activeView === 'conflict_checker' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          Conflict Checker
        </button>
        <button onClick={() => setActiveView('invoice_drafts')}
          className={`relative px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-widest transition-all ${activeView === 'invoice_drafts' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          Invoice Drafts
          {pendingDrafts.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
              {pendingDrafts.length}
            </span>
          )}
        </button>
      </div>

      {/* Conflict Checker */}
      {activeView === 'conflict_checker' && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Check Form */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <h3 className="font-serif text-lg text-foreground mb-4">Run Conflict Check</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Prospective Client Name *</label>
                <input type="text" placeholder="Full name or entity name" value={checkForm.checked_name} onChange={e => setCheckForm(p => ({ ...p, checked_name: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Email Address</label>
                <input type="email" placeholder="client@example.com" value={checkForm.checked_email} onChange={e => setCheckForm(p => ({ ...p, checked_email: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Business / Entity Name</label>
                <input type="text" placeholder="Company or organization" value={checkForm.checked_entity} onChange={e => setCheckForm(p => ({ ...p, checked_entity: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Opposing Party (if known)</label>
                <input type="text" placeholder="Opposing party name" value={checkForm.opposing_party} onChange={e => setCheckForm(p => ({ ...p, opposing_party: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Service Type</label>
                <input type="text" placeholder="e.g. Business Litigation" value={checkForm.service_type} onChange={e => setCheckForm(p => ({ ...p, service_type: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40" />
              </div>
              <button onClick={runConflictCheck} disabled={checking || !checkForm.checked_name.trim()}
                className="w-full py-2.5 rounded-xl text-white text-xs font-semibold uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: '#4A3728' }}>
                {checking ? 'Scanning Records…' : 'Run Conflict Check'}
              </button>
            </div>

            {/* Result */}
            {checkResult && (
              <div className={`mt-5 p-4 rounded-xl border ${RISK_COLORS[checkResult.risk_level]}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-sm">
                    {checkResult.risk_level === 'none' ? '✓ No Conflicts Found' : `⚠ ${checkResult.conflict_count} Conflict${checkResult.conflict_count !== 1 ? 's' : ''} Found`}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${RISK_COLORS[checkResult.risk_level]}`}>
                    {checkResult.risk_level.toUpperCase()} RISK
                  </span>
                </div>
                {checkResult.conflicts_found.length > 0 && (
                  <ul className="space-y-1.5 mt-3">
                    {checkResult.conflicts_found.map((c, i) => (
                      <li key={i} className="text-xs flex items-start gap-1.5">
                        <span className="mt-0.5">•</span>
                        <span>{c.description}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Recent Checks */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-serif text-lg text-foreground">Recent Checks</h3>
            </div>
            {loading ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
            ) : conflictChecks.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">No conflict checks yet.</div>
            ) : (
              <div className="divide-y divide-border max-h-96 overflow-y-auto">
                {conflictChecks.map(c => (
                  <div key={c.id} className="px-5 py-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-foreground text-sm">{c.checked_name}</p>
                        {c.checked_email && <p className="text-xs text-muted-foreground">{c.checked_email}</p>}
                        {c.opposing_party && <p className="text-xs text-muted-foreground">vs. {c.opposing_party}</p>}
                        <p className="text-xs text-muted-foreground/60 mt-0.5">{fmtDate(c.created_at)}</p>
                      </div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${RISK_COLORS[c.risk_level]}`}>
                        {c.risk_level === 'none' ? '✓ Clear' : `${c.conflict_count} conflict${c.conflict_count !== 1 ? 's' : ''}`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Invoice Drafts */}
      {activeView === 'invoice_drafts' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="font-serif text-lg text-foreground">Invoice Drafts from Lexi</h3>
              {pendingDrafts.length > 0 && (
                <span className="px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold">
                  {pendingDrafts.length} pending
                </span>
              )}
            </div>
            {loading ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
            ) : invoiceDrafts.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-muted-foreground text-sm">No invoice drafts yet. Lexi will auto-queue drafts when billable hours are logged.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {invoiceDrafts.map(draft => (
                  <button key={draft.id} onClick={() => setSelectedDraft(selectedDraft?.id === draft.id ? null : draft)}
                    className={`w-full px-5 py-4 text-left transition-colors hover:bg-secondary/30 ${selectedDraft?.id === draft.id ? 'bg-secondary/40' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-foreground text-sm">{draft.client_name}</p>
                        <p className="text-xs text-muted-foreground">{draft.total_hours}h @ {fmt(draft.hourly_rate)}/hr</p>
                        <p className="text-xs text-muted-foreground/60 mt-0.5">{fmtDate(draft.created_at)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-foreground">{fmt(draft.subtotal)}</p>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLORS[draft.draft_status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                          {draft.draft_status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Draft Detail */}
          {selectedDraft && (
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-serif text-lg text-foreground">{selectedDraft.client_name}</h3>
                  <p className="text-xs text-muted-foreground">{selectedDraft.client_email}</p>
                </div>
                <button onClick={() => setSelectedDraft(null)} className="text-muted-foreground/50 hover:text-foreground">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>

              {/* Line Items */}
              <div className="rounded-xl border border-border overflow-hidden mb-4">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-secondary/40 border-b border-border">
                      <th className="text-left px-3 py-2 text-muted-foreground font-semibold uppercase tracking-widest">Description</th>
                      <th className="text-right px-3 py-2 text-muted-foreground font-semibold uppercase tracking-widest">Hrs</th>
                      <th className="text-right px-3 py-2 text-muted-foreground font-semibold uppercase tracking-widest">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedDraft.line_items || []).map((item, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 text-foreground">{item.description}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{item.hours}</td>
                        <td className="px-3 py-2 text-right font-semibold">{fmt(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-secondary/20">
                      <td colSpan={2} className="px-3 py-2 text-right font-semibold text-foreground text-xs uppercase tracking-widest">Total</td>
                      <td className="px-3 py-2 text-right font-bold text-foreground">{fmt(selectedDraft.subtotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {selectedDraft.notes && (
                <p className="text-xs text-muted-foreground mb-4 p-3 bg-secondary/30 rounded-xl">{selectedDraft.notes}</p>
              )}

              {selectedDraft.draft_status === 'pending_approval' && (
                <div className="space-y-3">
                  <button onClick={() => handleApprove(selectedDraft)} disabled={processingId === selectedDraft.id}
                    className="w-full py-2.5 rounded-xl text-white text-xs font-semibold uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-50"
                    style={{ background: '#355E3B' }}>
                    {processingId === selectedDraft.id ? 'Processing…' : '✓ Approve & Create Invoice'}
                  </button>
                  <div>
                    <input type="text" placeholder="Rejection reason (required to reject)" value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-red-400/40 mb-2" />
                    <button onClick={() => handleReject(selectedDraft)} disabled={processingId === selectedDraft.id || !rejectReason.trim()}
                      className="w-full py-2.5 rounded-xl border border-red-200 text-red-600 text-xs font-semibold uppercase tracking-widest transition-all hover:bg-red-50 disabled:opacity-50">
                      Reject Draft
                    </button>
                  </div>
                </div>
              )}

              {selectedDraft.draft_status === 'approved' && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
                  ✓ Approved by {selectedDraft.approved_by} on {selectedDraft.approved_at ? fmtDate(selectedDraft.approved_at) : '—'}
                </div>
              )}

              {selectedDraft.draft_status === 'rejected' && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                  Rejected: {selectedDraft.rejection_reason}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
