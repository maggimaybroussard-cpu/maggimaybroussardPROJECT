'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { logAuditEvent, getAdminEmail } from '@/lib/auditLogger';

interface PortalClient {
  id: string;
  user_id: string;
  inquiry_id: string;
  created_at: string;
  contact_inquiries: {
    name: string;
    email: string;
    firm: string;
    service: string;
    status: string;
  } | null;
}

interface InquiryOption {
  id: string;
  name: string;
  email: string;
  firm: string;
  service: string;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const SERVICE_TYPES = [
  'All Services',
  'Business Formation',
  'Contract Drafting',
  'Contract Review',
  'Employment Law',
  'General Counsel',
  'Intellectual Property',
  'Litigation',
  'Real Estate',
  'Other',
];

const CASE_STAGES = [
  'All Stages',
  'new',
  'intake',
  'active',
  'pending',
  'review',
  'closed',
  'archived',
];

const STAGE_LABELS: Record<string, string> = {
  new: 'New',
  intake: 'Intake',
  active: 'Active',
  pending: 'Pending',
  review: 'In Review',
  closed: 'Closed',
  archived: 'Archived',
};

const STAGE_COLORS: Record<string, string> = {
  new: 'bg-blue-50 text-blue-700 border-blue-200',
  intake: 'bg-amber-50 text-amber-700 border-amber-200',
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending: 'bg-orange-50 text-orange-700 border-orange-200',
  review: 'bg-purple-50 text-purple-700 border-purple-200',
  closed: 'bg-gray-100 text-gray-600 border-gray-200',
  archived: 'bg-gray-50 text-gray-500 border-gray-200',
};

const STAGE_DOT_COLORS: Record<string, string> = {
  new: 'bg-blue-500',
  intake: 'bg-amber-500',
  active: 'bg-emerald-500',
  pending: 'bg-orange-500',
  review: 'bg-purple-500',
  closed: 'bg-gray-400',
  archived: 'bg-gray-300',
};

function getStatusTag(status: string) {
  const s = (status || 'new').toLowerCase();
  const label = STAGE_LABELS[s] ?? status;
  const colorClass = STAGE_COLORS[s] ?? 'bg-gray-100 text-gray-600 border-gray-200';
  const dotClass = STAGE_DOT_COLORS[s] ?? 'bg-gray-400';
  return { label, colorClass, dotClass };
}

export default function ClientsTab() {
  const [clients, setClients] = useState<PortalClient[]>([]);
  const [inquiries, setInquiries] = useState<InquiryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterService, setFilterService] = useState('All Services');
  const [filterStage, setFilterStage] = useState('All Stages');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
  const [emailCampaignOpen, setEmailCampaignOpen] = useState(false);
  const [campaignSubject, setCampaignSubject] = useState('');
  const [campaignBody, setCampaignBody] = useState('');
  const [campaignSending, setCampaignSending] = useState(false);
  const [campaignResult, setCampaignResult] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const bulkMenuRef = useRef<HTMLDivElement>(null);

  // Invite form state
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteMode, setInviteMode] = useState<'existing' | 'new'>('existing');
  const [selectedInquiryId, setSelectedInquiryId] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const supabase = createClient();

  const fetchClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/invite-client');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load clients');
      setClients(data.clients ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchInquiries = useCallback(async () => {
    const { data } = await supabase
      .from('contact_inquiries')
      .select('id, name, email, firm, service')
      .order('created_at', { ascending: false });
    setInquiries(data ?? []);
  }, [supabase]);

  useEffect(() => {
    fetchClients();
    fetchInquiries();
  }, [fetchClients, fetchInquiries]);

  // Close bulk menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (bulkMenuRef.current && !bulkMenuRef.current.contains(e.target as Node)) {
        setBulkMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    setInviteResult(null);

    let name = newName;
    let email = newEmail;
    let inquiryId: string | undefined;

    if (inviteMode === 'existing') {
      const inq = inquiries.find((i) => i.id === selectedInquiryId);
      if (!inq) {
        setInviteResult({ type: 'error', msg: 'Please select a client from the list.' });
        setInviting(false);
        return;
      }
      name = inq.name;
      email = inq.email;
      inquiryId = inq.id;
    }

    if (!name || !email) {
      setInviteResult({ type: 'error', msg: 'Name and email are required.' });
      setInviting(false);
      return;
    }

    try {
      const res = await fetch('/api/admin/invite-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, inquiryId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invite failed');

      const msg = data.note
        ? `Account created for ${name}. Note: ${data.note}`
        : `Invite sent to ${email}. They'll receive a portal access link.`;
      setInviteResult({ type: 'success', msg });
      setShowInviteForm(false);
      setSelectedInquiryId('');
      setNewName('');
      setNewEmail('');
      fetchClients();

      const actor = await getAdminEmail();
      logAuditEvent({
        action_type: 'client_invited',
        actor_email: actor.email,
        actor_id: actor.id,
        target_type: 'client',
        target_id: inquiryId,
        target_label: `${name} (${email})`,
        description: `Client portal invite sent to ${name} <${email}>`,
        metadata: { client_email: email, inquiry_id: inquiryId ?? null },
      });
    } catch (err) {
      setInviteResult({ type: 'error', msg: err instanceof Error ? err.message : 'Invite failed' });
    } finally {
      setInviting(false);
    }
  };

  // Filtered list
  const filtered = clients.filter((c) => {
    const inq = c.contact_inquiries;
    if (filterService !== 'All Services') {
      const svc = (inq?.service ?? '').toLowerCase();
      if (!svc.includes(filterService.toLowerCase())) return false;
    }
    if (filterStage !== 'All Stages') {
      const stage = (inq?.status ?? 'new').toLowerCase();
      if (stage !== filterStage.toLowerCase()) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      return (
        inq?.name?.toLowerCase().includes(q) ||
        inq?.email?.toLowerCase().includes(q) ||
        inq?.firm?.toLowerCase().includes(q) ||
        inq?.service?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Bulk selection helpers
  const allFilteredSelected = filtered.length > 0 && filtered.every((c) => selectedIds.has(c.id));
  const someSelected = selectedIds.size > 0;

  function toggleSelectAll() {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((c) => c.id)));
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Export selected as CSV
  function handleExportCSV() {
    const rows = filtered.filter((c) => selectedIds.has(c.id));
    const headers = ['Name', 'Email', 'Firm', 'Service', 'Status', 'Invited'];
    const csvRows = [
      headers.join(','),
      ...rows.map((c) => {
        const inq = c.contact_inquiries;
        return [
          `"${inq?.name ?? ''}"`,
          `"${inq?.email ?? ''}"`,
          `"${inq?.firm ?? ''}"`,
          `"${inq?.service ?? ''}"`,
          `"${inq?.status ?? ''}"`,
          `"${formatDate(c.created_at)}"`,
        ].join(',');
      }),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clients-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setBulkMenuOpen(false);
  }

  // Email campaign
  async function handleSendCampaign(e: React.FormEvent) {
    e.preventDefault();
    setCampaignSending(true);
    setCampaignResult(null);
    const targets = filtered.filter((c) => selectedIds.has(c.id));
    const emails = targets.map((c) => ({
      name: c.contact_inquiries?.name ?? '',
      email: c.contact_inquiries?.email ?? '',
    })).filter((t) => t.email);

    try {
      const res = await fetch('/api/admin/send-client-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients: emails, subject: campaignSubject, body: campaignBody }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send campaign');
      setCampaignResult({ type: 'success', msg: `Campaign sent to ${emails.length} client${emails.length !== 1 ? 's' : ''}.` });
      setCampaignSubject('');
      setCampaignBody('');
      setTimeout(() => { setEmailCampaignOpen(false); setCampaignResult(null); }, 2500);
    } catch (err) {
      setCampaignResult({ type: 'error', msg: err instanceof Error ? err.message : 'Failed to send campaign' });
    } finally {
      setCampaignSending(false);
    }
  }

  // Unique service types from data for filter dropdown
  const serviceOptions = ['All Services', ...Array.from(new Set(clients.map((c) => c.contact_inquiries?.service).filter(Boolean) as string[]))];

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {clients.length} client{clients.length !== 1 ? 's' : ''} with portal access
          </p>
        </div>
        <button
          onClick={() => { setShowInviteForm(!showInviteForm); setInviteResult(null); }}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all hover:opacity-90"
          style={{ background: '#355E3B', color: '#fff' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
          </svg>
          Invite Client
        </button>
      </div>

      {/* Invite result banner */}
      {inviteResult && (
        <div className={`flex items-start gap-3 p-4 rounded-xl border text-sm ${
          inviteResult.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {inviteResult.type === 'success' ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          )}
          <span>{inviteResult.msg}</span>
          <button onClick={() => setInviteResult(null)} className="ml-auto text-current opacity-50 hover:opacity-100">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      )}

      {/* Invite form */}
      {showInviteForm && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-serif text-lg text-foreground">Invite Client to Portal</h3>
              <p className="text-xs text-muted-foreground mt-0.5">They'll receive a branded email with a secure setup link</p>
            </div>
            <button
              onClick={() => setShowInviteForm(false)}
              className="text-muted-foreground/50 hover:text-foreground transition-colors p-1"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div className="flex gap-2 mb-5">
            <button
              type="button"
              onClick={() => setInviteMode('existing')}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold uppercase tracking-widest border transition-all ${
                inviteMode === 'existing' ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent text-muted-foreground border-border hover:border-foreground/30'
              }`}
            >
              From Existing Lead
            </button>
            <button
              type="button"
              onClick={() => setInviteMode('new')}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold uppercase tracking-widest border transition-all ${
                inviteMode === 'new' ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent text-muted-foreground border-border hover:border-foreground/30'
              }`}
            >
              New Client
            </button>
          </div>
          <form onSubmit={handleInvite} className="space-y-4">
            {inviteMode === 'existing' ? (
              <div>
                <label className="block text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">
                  Select Lead / Inquiry
                </label>
                <select
                  value={selectedInquiryId}
                  onChange={(e) => setSelectedInquiryId(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all appearance-none"
                >
                  <option value="">— Choose a client —</option>
                  {inquiries.map((inq) => (
                    <option key={inq.id} value={inq.id}>
                      {inq.name} ({inq.email}) — {inq.service}
                    </option>
                  ))}
                </select>
                {selectedInquiryId && (() => {
                  const inq = inquiries.find((i) => i.id === selectedInquiryId);
                  return inq ? (
                    <div className="mt-2 px-3 py-2 rounded-lg bg-secondary/40 border border-border text-xs text-muted-foreground flex items-center gap-3">
                      <span className="font-medium text-foreground">{inq.name}</span>
                      <span>·</span>
                      <span>{inq.email}</span>
                      <span>·</span>
                      <span>{inq.firm}</span>
                    </div>
                  ) : null;
                })()}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">Full Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    required
                    placeholder="Jane Smith"
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">Email Address</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    required
                    placeholder="jane@example.com"
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
                  />
                </div>
              </div>
            )}
            <div className="pt-2 flex items-center gap-3">
              <button
                type="submit"
                disabled={inviting}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-60"
                style={{ background: '#355E3B', color: '#fff' }}
              >
                {inviting ? (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                    Sending Invite…
                  </>
                ) : (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                    Send Portal Invite
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowInviteForm(false)}
                className="px-4 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search + Filters row */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50"
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search by name, email, firm…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
          />
        </div>

        {/* Service filter */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
          </svg>
          <select
            value={filterService}
            onChange={(e) => setFilterService(e.target.value)}
            className="pl-8 pr-8 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all appearance-none cursor-pointer"
          >
            {serviceOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Stage filter */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
          </svg>
          <select
            value={filterStage}
            onChange={(e) => setFilterStage(e.target.value)}
            className="pl-8 pr-8 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all appearance-none cursor-pointer"
          >
            {CASE_STAGES.map((s) => (
              <option key={s} value={s}>{s === 'All Stages' ? 'All Stages' : (STAGE_LABELS[s] ?? s)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Active filters summary */}
      {(filterService !== 'All Services' || filterStage !== 'All Stages' || search) && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Filters:</span>
          {search && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary border border-border text-xs text-foreground">
              Search: "{search}"
              <button onClick={() => setSearch('')} className="ml-1 opacity-50 hover:opacity-100">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </span>
          )}
          {filterService !== 'All Services' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary border border-border text-xs text-foreground">
              Service: {filterService}
              <button onClick={() => setFilterService('All Services')} className="ml-1 opacity-50 hover:opacity-100">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </span>
          )}
          {filterStage !== 'All Stages' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary border border-border text-xs text-foreground">
              Stage: {STAGE_LABELS[filterStage] ?? filterStage}
              <button onClick={() => setFilterStage('All Stages')} className="ml-1 opacity-50 hover:opacity-100">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </span>
          )}
          <button
            onClick={() => { setSearch(''); setFilterService('All Services'); setFilterStage('All Stages'); }}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Bulk action bar */}
      {someSelected && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/5 border border-primary/20">
          <span className="text-sm font-medium text-foreground">
            {selectedIds.size} client{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-border bg-card text-xs font-semibold text-foreground hover:bg-secondary/60 transition-all"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export CSV
            </button>
            <button
              onClick={() => { setEmailCampaignOpen(true); setBulkMenuOpen(false); }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-border bg-card text-xs font-semibold text-foreground hover:bg-secondary/60 transition-all"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
              </svg>
              Email Campaign
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Deselect
            </button>
          </div>
        </div>
      )}

      {/* Email campaign modal */}
      {emailCampaignOpen && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-serif text-lg text-foreground">Email Campaign</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Sending to {selectedIds.size} selected client{selectedIds.size !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={() => { setEmailCampaignOpen(false); setCampaignResult(null); }}
              className="text-muted-foreground/50 hover:text-foreground transition-colors p-1"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {campaignResult && (
            <div className={`flex items-center gap-2 p-3 rounded-xl border text-sm mb-4 ${
              campaignResult.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-700'
            }`}>
              {campaignResult.type === 'success' ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              )}
              {campaignResult.msg}
            </div>
          )}

          <form onSubmit={handleSendCampaign} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">Subject Line</label>
              <input
                type="text"
                value={campaignSubject}
                onChange={(e) => setCampaignSubject(e.target.value)}
                required
                placeholder="Important update from Broussard Legal Services"
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">Message</label>
              <textarea
                value={campaignBody}
                onChange={(e) => setCampaignBody(e.target.value)}
                required
                rows={5}
                placeholder="Write your message here…"
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all resize-none"
              />
            </div>
            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={campaignSending}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-60"
                style={{ background: '#355E3B', color: '#fff' }}
              >
                {campaignSending ? (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    Sending…
                  </>
                ) : (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                    Send to {selectedIds.size} Client{selectedIds.size !== 1 ? 's' : ''}
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => { setEmailCampaignOpen(false); setCampaignResult(null); }}
                className="px-4 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </div>
      )}

      {/* Clients table */}
      {loading ? (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="border-b border-border bg-secondary/40 px-5 py-3 flex gap-6">
            <div className="w-28 h-3 bg-muted/50 rounded animate-pulse" />
            <div className="w-20 h-3 bg-muted/50 rounded animate-pulse hidden sm:block" />
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="border-b border-border last:border-0 px-5 py-4 flex items-center gap-4">
              <div className="w-4 h-4 bg-muted/50 rounded animate-pulse" />
              <div className="flex-1 min-w-0">
                <div className="w-36 h-4 bg-muted/60 rounded animate-pulse mb-1.5" />
                <div className="w-24 h-3 bg-muted/40 rounded animate-pulse" />
              </div>
              <div className="w-24 h-3 bg-muted/40 rounded animate-pulse hidden sm:block" />
              <div className="w-16 h-6 bg-muted/50 rounded-full animate-pulse" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <div className="w-14 h-14 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-4">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
            </svg>
          </div>
          <p className="text-foreground font-medium mb-1">
            {search || filterService !== 'All Services' || filterStage !== 'All Stages' ?'No clients match your filters' :'No portal clients yet'}
          </p>
          <p className="text-muted-foreground text-sm">
            {search || filterService !== 'All Services' || filterStage !== 'All Stages' ?'Try adjusting your search or filters.' :'Click "Invite Client" above to grant a client portal access.'}
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/40">
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleSelectAll}
                      className="rounded border-border accent-primary cursor-pointer"
                      title="Select all"
                    />
                  </th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Client</th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden sm:table-cell">Firm</th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden md:table-cell">Service</th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Stage</th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden lg:table-cell">Invited</th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Case</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((client, i) => {
                  const inq = client.contact_inquiries;
                  const { label, colorClass, dotClass } = getStatusTag(inq?.status ?? 'active');
                  const isSelected = selectedIds.has(client.id);
                  return (
                    <tr
                      key={client.id}
                      className={`border-b border-border last:border-0 transition-colors ${
                        isSelected ? 'bg-primary/5' : i % 2 === 0 ? '' : 'bg-secondary/10'
                      } hover:bg-secondary/20`}
                    >
                      <td className="px-4 py-3.5 w-10">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(client.id)}
                          className="rounded border-border accent-primary cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-medium text-foreground">{inq?.name ?? '—'}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{inq?.email ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3.5 hidden sm:table-cell text-foreground/80">
                        {inq?.firm ?? '—'}
                      </td>
                      <td className="px-4 py-3.5 hidden md:table-cell text-muted-foreground text-xs">
                        {inq?.service ?? '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${colorClass}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
                          {label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 hidden lg:table-cell text-muted-foreground text-xs">
                        {formatDate(client.created_at)}
                      </td>
                      <td className="px-4 py-3.5">
                        {client.inquiry_id && (
                          <Link
                            href={`/admin/cases/${client.inquiry_id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                          >
                            View →
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-border bg-secondary/20 flex items-center justify-between text-xs text-muted-foreground">
            <span>Showing {filtered.length} of {clients.length} portal client{clients.length !== 1 ? 's' : ''}</span>
            {someSelected && (
              <span className="text-primary font-medium">{selectedIds.size} selected</span>
            )}
          </div>
        </div>
      )}

      {/* Info box */}
      <div className="bg-card border border-border rounded-2xl p-5 flex gap-4">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-foreground mb-1">How portal invites work</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            When you invite a client, they receive a branded email with a secure link to set up their password and access their portal at <span className="font-mono text-foreground/70">/portal/login</span>.
            They can then view their case status, documents, and invoices. Requires <span className="font-mono text-foreground/70">RESEND_API_KEY</span> and <span className="font-mono text-foreground/70">SUPABASE_SERVICE_ROLE_KEY</span> to be configured.
          </p>
        </div>
      </div>
    </div>
  );
}
