'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClioMatter {
  id: string;
  clio_id: number;
  display_number: string | null;
  description: string | null;
  status: string | null;
  client_name: string | null;
  practice_area: string | null;
  open_date: string | null;
  close_date: string | null;
  responsible_attorney: string | null;
  billable: boolean | null;
  synced_at: string | null;
}

interface ClioContact {
  id: string;
  clio_id: number;
  name: string | null;
  contact_type: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  title: string | null;
  address_city: string | null;
  address_state: string | null;
  synced_at: string | null;
}

interface ClioTimeEntry {
  id: string;
  clio_id: number;
  matter_description: string | null;
  user_name: string | null;
  date: string | null;
  quantity_hours: number | null;
  price: number | null;
  total: number | null;
  note: string | null;
  billable: boolean | null;
  billed: boolean | null;
  activity_description: string | null;
  synced_at: string | null;
}

interface SyncResult {
  synced: number;
  error?: string;
}

type ActiveDataTab = 'matters' | 'contacts' | 'time_entries';

const SYNC_TYPES = [
  { key: 'matters', label: 'Matters', icon: '⚖️' },
  { key: 'contacts', label: 'Contacts', icon: '👥' },
  { key: 'time_entries', label: 'Time Entries', icon: '⏱️' },
];

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-600',
  pending: 'bg-yellow-100 text-yellow-700',
  active: 'bg-blue-100 text-blue-700',
};

// ─── Convert to Booking Modal ─────────────────────────────────────────────────

function ConvertToBookingModal({
  contact,
  onClose,
  onSuccess,
}: {
  contact: ClioContact;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [notes, setNotes] = useState('');
  const [service, setService] = useState('Initial Consultation');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: insertError } = await supabase.from('contact_inquiries').insert({
        name: contact.name ?? '',
        email: contact.email ?? '',
        firm: contact.company ?? '',
        service,
        message: notes || `Converted from Clio contact (ID: ${contact.clio_id})`,
        status: 'new',
        notes: `Source: Clio CRM | Phone: ${contact.phone ?? 'N/A'} | Type: ${contact.contact_type ?? 'N/A'}`,
      });
      if (insertError) throw new Error(insertError.message);
      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-semibold text-[#1B2A4A]">Convert to Booking</h3>
            <p className="text-sm text-gray-500 mt-0.5">{contact.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 space-y-1.5">
            {contact.email && (
              <p className="text-sm text-gray-600"><span className="font-medium">Email:</span> {contact.email}</p>
            )}
            {contact.phone && (
              <p className="text-sm text-gray-600"><span className="font-medium">Phone:</span> {contact.phone}</p>
            )}
            {contact.company && (
              <p className="text-sm text-gray-600"><span className="font-medium">Company:</span> {contact.company}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-[#1B2A4A] mb-1.5">Service Type</label>
            <select
              value={service}
              onChange={e => setService(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/20 focus:border-[#1B2A4A]"
            >
              <option>Initial Consultation</option>
              <option>Business Formation</option>
              <option>Contract Review</option>
              <option>Employment Law</option>
              <option>Litigation</option>
              <option>Estate Planning</option>
              <option>General Inquiry</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#1B2A4A] mb-1.5">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Add any notes about this booking..."
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/20 focus:border-[#1B2A4A] resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-[#1B2A4A] text-white text-sm font-medium hover:bg-[#1B2A4A]/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating…
                </>
              ) : (
                'Create Booking'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ClioSyncDashboard() {
  const [activeDataTab, setActiveDataTab] = useState<ActiveDataTab>('matters');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [billableFilter, setBillableFilter] = useState('all');

  const [matters, setMatters] = useState<ClioMatter[]>([]);
  const [contacts, setContacts] = useState<ClioContact[]>([]);
  const [timeEntries, setTimeEntries] = useState<ClioTimeEntry[]>([]);

  const [loadingData, setLoadingData] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncResults, setSyncResults] = useState<Record<string, SyncResult> | null>(null);
  const [clioConnected, setClioConnected] = useState<boolean | null>(null);

  const [convertContact, setConvertContact] = useState<ClioContact | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const supabase = createClient();

  const fetchClioStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/clio/status');
      const data = await res.json();
      setClioConnected(data.connected);
    } catch {
      setClioConnected(false);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [mattersRes, contactsRes, timeRes] = await Promise.all([
        supabase.from('clio_matters').select('*').order('synced_at', { ascending: false }),
        supabase.from('clio_contacts').select('*').order('synced_at', { ascending: false }),
        supabase.from('clio_time_entries').select('*').order('date', { ascending: false }),
      ]);
      setMatters(mattersRes.data ?? []);
      setContacts(contactsRes.data ?? []);
      setTimeEntries(timeRes.data ?? []);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    fetchClioStatus();
    fetchData();
  }, [fetchClioStatus, fetchData]);

  const handleSync = async (type: string) => {
    setSyncing(type);
    setSyncResults(null);
    try {
      const res = await fetch('/api/clio/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ types: [type] }),
      });
      const data = await res.json();
      setSyncResults(data.results);
      await fetchData();
    } finally {
      setSyncing(null);
    }
  };

  const handleSyncAll = async () => {
    setSyncing('all');
    setSyncResults(null);
    try {
      const res = await fetch('/api/clio/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ types: ['matters', 'contacts', 'time_entries'] }),
      });
      const data = await res.json();
      setSyncResults(data.results);
      await fetchData();
    } finally {
      setSyncing(null);
    }
  };

  // ── Filtered data ──────────────────────────────────────────────────────────

  const filteredMatters = matters.filter(m => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      m.description?.toLowerCase().includes(q) ||
      m.client_name?.toLowerCase().includes(q) ||
      m.display_number?.toLowerCase().includes(q) ||
      m.practice_area?.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || m.status?.toLowerCase() === statusFilter;
    const matchesBillable =
      billableFilter === 'all' ||
      (billableFilter === 'billable' && m.billable) ||
      (billableFilter === 'non_billable' && !m.billable);
    return matchesSearch && matchesStatus && matchesBillable;
  });

  const filteredContacts = contacts.filter(c => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      c.name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.company?.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q);
    const matchesType = statusFilter === 'all' || c.contact_type?.toLowerCase() === statusFilter;
    return matchesSearch && matchesType;
  });

  const filteredTimeEntries = timeEntries.filter(e => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      e.matter_description?.toLowerCase().includes(q) ||
      e.user_name?.toLowerCase().includes(q) ||
      e.note?.toLowerCase().includes(q) ||
      e.activity_description?.toLowerCase().includes(q);
    const matchesBillable =
      billableFilter === 'all' ||
      (billableFilter === 'billable' && e.billable) ||
      (billableFilter === 'non_billable' && !e.billable) ||
      (billableFilter === 'billed' && e.billed) ||
      (billableFilter === 'unbilled' && e.billable && !e.billed);
    return matchesSearch && matchesBillable;
  });

  const totalHours = filteredTimeEntries.reduce((sum, e) => sum + (e.quantity_hours ?? 0), 0);
  const totalBillable = filteredTimeEntries.reduce((sum, e) => sum + (e.billable ? (e.total ?? 0) : 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1B2A4A] flex items-center justify-center flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M2 17l10 5 10-5" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M2 12l10 5 10-5" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#1B2A4A]">Clio Sync</h2>
            <p className="text-sm text-gray-500">
              {clioConnected === null ? 'Checking connection…' : clioConnected ? 'Connected — synced data below' : 'Not connected to Clio'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {clioConnected === false && (
            <a
              href="/api/clio/auth"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1B2A4A] text-white text-sm font-medium rounded-xl hover:bg-[#1B2A4A]/90 transition-colors"
            >
              Connect Clio
            </a>
          )}
          {clioConnected && (
            <button
              onClick={handleSyncAll}
              disabled={syncing !== null}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1B2A4A] text-white text-sm font-medium rounded-xl hover:bg-[#1B2A4A]/90 transition-colors disabled:opacity-50"
            >
              {syncing === 'all' ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Syncing All…
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
                  </svg>
                  Sync All
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Success message */}
      {successMessage && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          {successMessage}
          <button onClick={() => setSuccessMessage(null)} className="ml-auto text-green-500 hover:text-green-700">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      )}

      {/* Sync results banner */}
      {syncResults && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-sm font-medium text-[#1B2A4A] mb-2">Last Sync Results</p>
          <div className="flex flex-wrap gap-3">
            {Object.entries(syncResults).map(([type, result]) => (
              <div key={type} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${result.error ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
                {result.error ? `✗ ${type.replace('_', ' ')}: ${result.error}` : `✓ ${type.replace('_', ' ')}: ${result.synced} records`}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Matters', count: matters.length, icon: '⚖️', tab: 'matters' as ActiveDataTab },
          { label: 'Contacts', count: contacts.length, icon: '👥', tab: 'contacts' as ActiveDataTab },
          { label: 'Time Entries', count: timeEntries.length, icon: '⏱️', tab: 'time_entries' as ActiveDataTab },
        ].map(stat => (
          <button
            key={stat.tab}
            onClick={() => { setActiveDataTab(stat.tab); setSearch(''); setStatusFilter('all'); setBillableFilter('all'); }}
            className={`rounded-xl border p-4 text-center transition-all ${activeDataTab === stat.tab ? 'border-[#1B2A4A] bg-[#1B2A4A]/5' : 'border-gray-200 bg-white hover:border-gray-300'}`}
          >
            <div className="text-2xl mb-1">{stat.icon}</div>
            <div className="text-xl font-bold text-[#1B2A4A]">{stat.count}</div>
            <div className="text-xs text-gray-500 mt-0.5">{stat.label}</div>
          </button>
        ))}
      </div>

      {/* Tab bar + per-type sync button */}
      <div className="flex items-center justify-between border-b border-gray-200">
        <div className="flex gap-1">
          {SYNC_TYPES.map(t => (
            <button
              key={t.key}
              onClick={() => { setActiveDataTab(t.key as ActiveDataTab); setSearch(''); setStatusFilter('all'); setBillableFilter('all'); }}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeDataTab === t.key
                  ? 'border-[#1B2A4A] text-[#1B2A4A]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        {clioConnected && (
          <button
            onClick={() => handleSync(activeDataTab)}
            disabled={syncing !== null}
            className="mb-1 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#1B2A4A] border border-[#1B2A4A]/30 rounded-lg hover:bg-[#1B2A4A]/5 transition-colors disabled:opacity-50"
          >
            {syncing === activeDataTab ? (
              <>
                <div className="w-3 h-3 border-2 border-[#1B2A4A] border-t-transparent rounded-full animate-spin" />
                Syncing…
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
                </svg>
                Sync {SYNC_TYPES.find(t => t.key === activeDataTab)?.label}
              </>
            )}
          </button>
        )}
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${activeDataTab.replace('_', ' ')}…`}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/20 focus:border-[#1B2A4A]"
          />
        </div>

        {activeDataTab === 'matters' && (
          <>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/20 focus:border-[#1B2A4A] bg-white"
            >
              <option value="all">All Statuses</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
              <option value="pending">Pending</option>
            </select>
            <select
              value={billableFilter}
              onChange={e => setBillableFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/20 focus:border-[#1B2A4A] bg-white"
            >
              <option value="all">All Types</option>
              <option value="billable">Billable</option>
              <option value="non_billable">Non-Billable</option>
            </select>
          </>
        )}

        {activeDataTab === 'contacts' && (
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/20 focus:border-[#1B2A4A] bg-white"
          >
            <option value="all">All Types</option>
            <option value="person">Person</option>
            <option value="company">Company</option>
          </select>
        )}

        {activeDataTab === 'time_entries' && (
          <select
            value={billableFilter}
            onChange={e => setBillableFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/20 focus:border-[#1B2A4A] bg-white"
          >
            <option value="all">All Entries</option>
            <option value="billable">Billable</option>
            <option value="non_billable">Non-Billable</option>
            <option value="billed">Billed</option>
            <option value="unbilled">Unbilled</option>
          </select>
        )}
      </div>

      {/* Data tables */}
      {loadingData ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#1B2A4A] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ── Matters ── */}
          {activeDataTab === 'matters' && (
            <div className="space-y-2">
              {filteredMatters.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">
                  {matters.length === 0 ? 'No matters synced yet. Click "Sync Matters" to pull from Clio.' : 'No matters match your search.'}
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-400">{filteredMatters.length} matter{filteredMatters.length !== 1 ? 's' : ''}</p>
                  <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Matter</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Client</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Practice Area</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Attorney</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Opened</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {filteredMatters.map(m => (
                          <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3">
                              <p className="font-medium text-[#1B2A4A] truncate max-w-[200px]">{m.description ?? '—'}</p>
                              {m.display_number && <p className="text-xs text-gray-400 mt-0.5">{m.display_number}</p>}
                            </td>
                            <td className="px-4 py-3 text-gray-700">{m.client_name ?? '—'}</td>
                            <td className="px-4 py-3 text-gray-600 text-xs">{m.practice_area ?? '—'}</td>
                            <td className="px-4 py-3">
                              {m.status ? (
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[m.status.toLowerCase()] ?? 'bg-gray-100 text-gray-600'}`}>
                                  {m.status}
                                </span>
                              ) : '—'}
                            </td>
                            <td className="px-4 py-3 text-gray-600 text-xs">{m.responsible_attorney ?? '—'}</td>
                            <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                              {m.open_date ? new Date(m.open_date).toLocaleDateString() : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Contacts ── */}
          {activeDataTab === 'contacts' && (
            <div className="space-y-2">
              {filteredContacts.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">
                  {contacts.length === 0 ? 'No contacts synced yet. Click "Sync Contacts" to pull from Clio.' : 'No contacts match your search.'}
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-400">{filteredContacts.length} contact{filteredContacts.length !== 1 ? 's' : ''}</p>
                  <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Phone</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Company</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {filteredContacts.map(c => (
                          <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3">
                              <p className="font-medium text-[#1B2A4A]">{c.name ?? '—'}</p>
                              {c.title && <p className="text-xs text-gray-400 mt-0.5">{c.title}</p>}
                            </td>
                            <td className="px-4 py-3 text-gray-600 text-xs">{c.email ?? '—'}</td>
                            <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{c.phone ?? '—'}</td>
                            <td className="px-4 py-3 text-gray-600 text-xs">{c.company ?? '—'}</td>
                            <td className="px-4 py-3">
                              {c.contact_type ? (
                                <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 capitalize">
                                  {c.contact_type}
                                </span>
                              ) : '—'}
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => setConvertContact(c)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#1B2A4A]/10 text-[#1B2A4A] text-xs font-medium hover:bg-[#1B2A4A]/20 transition-colors whitespace-nowrap"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                                </svg>
                                Convert to Booking
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Time Entries ── */}
          {activeDataTab === 'time_entries' && (
            <div className="space-y-2">
              {filteredTimeEntries.length > 0 && (
                <div className="flex gap-4 flex-wrap">
                  <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                    <p className="text-xs text-gray-500">Total Hours</p>
                    <p className="text-lg font-bold text-[#1B2A4A]">{totalHours.toFixed(2)}</p>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                    <p className="text-xs text-gray-500">Billable Amount</p>
                    <p className="text-lg font-bold text-[#1B2A4A]">${totalBillable.toFixed(2)}</p>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                    <p className="text-xs text-gray-500">Entries</p>
                    <p className="text-lg font-bold text-[#1B2A4A]">{filteredTimeEntries.length}</p>
                  </div>
                </div>
              )}
              {filteredTimeEntries.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">
                  {timeEntries.length === 0 ? 'No time entries synced yet. Click "Sync Time Entries" to pull from Clio.' : 'No entries match your search.'}
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-400">{filteredTimeEntries.length} entr{filteredTimeEntries.length !== 1 ? 'ies' : 'y'}</p>
                  <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Matter</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Attorney</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Activity</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Hours</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {filteredTimeEntries.map(e => (
                          <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                              {e.date ? new Date(e.date).toLocaleDateString() : '—'}
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-gray-700 truncate max-w-[180px]">{e.matter_description ?? '—'}</p>
                              {e.note && <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[180px]">{e.note}</p>}
                            </td>
                            <td className="px-4 py-3 text-gray-600 text-xs">{e.user_name ?? '—'}</td>
                            <td className="px-4 py-3 text-gray-600 text-xs">{e.activity_description ?? '—'}</td>
                            <td className="px-4 py-3 text-right font-medium text-[#1B2A4A]">
                              {e.quantity_hours != null ? e.quantity_hours.toFixed(2) : '—'}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-700">
                              {e.total != null ? `$${e.total.toFixed(2)}` : '—'}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-1">
                                {e.billable ? (
                                  <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">Billable</span>
                                ) : (
                                  <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Non-Billable</span>
                                )}
                                {e.billable && (
                                  e.billed ? (
                                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600">Billed</span>
                                  ) : (
                                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-50 text-yellow-600">Unbilled</span>
                                  )
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* Convert to Booking Modal */}
      {convertContact && (
        <ConvertToBookingModal
          contact={convertContact}
          onClose={() => setConvertContact(null)}
          onSuccess={() => {
            setConvertContact(null);
            setSuccessMessage(`${convertContact.name} has been added as a new booking inquiry.`);
          }}
        />
      )}
    </div>
  );
}
