'use client';

import { useState, useEffect, useCallback } from 'react';

// ── Airtable config ────────────────────────────────────────────────────────────
const BASE_ID = 'app6Tk6mUPY4K4ydc';
const API_BASE = 'https://api.airtable.com/v0';

const TABLES = {
  contacts: 'tbl2TPsG5UHWYPL3n',
  matters: 'tbluuuso1n21Yu8Rp',
  followups: 'tblPrEKXS87nM9WhP',
};

// ── Types ──────────────────────────────────────────────────────────────────────
interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
  createdTime?: string;
}

interface Contact {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  status: string;
  practiceArea: string;
  source: string;
  notes: string;
  created: string;
}

interface Matter {
  id: string;
  matterName: string;
  clientName: string;
  status: string;
  practiceArea: string;
  openDate: string;
  closeDate: string;
  description: string;
  billingType: string;
}

interface FollowUp {
  id: string;
  title: string;
  contactName: string;
  dueDate: string;
  priority: string;
  status: string;
  type: string;
  notes: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function getApiKey(): string {
  return (process.env.NEXT_PUBLIC_AIRTABLE_API_KEY || process.env.AIRTABLE_API_KEY || '');
}

async function airtableFetch(tableId: string, method = 'GET', body?: Record<string, unknown>) {
  const key = getApiKey();
  const url = `${API_BASE}/${BASE_ID}/${tableId}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: { message?: string } })?.error?.message || `HTTP ${res.status}`);
  }
  return res.json();
}

async function airtableUpdate(tableId: string, recordId: string, fields: Record<string, unknown>) {
  const key = getApiKey();
  const url = `${API_BASE}/${BASE_ID}/${tableId}/${recordId}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: { message?: string } })?.error?.message || `HTTP ${res.status}`);
  }
  return res.json();
}

async function airtableDelete(tableId: string, recordId: string) {
  const key = getApiKey();
  const url = `${API_BASE}/${BASE_ID}/${tableId}/${recordId}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function mapContact(r: AirtableRecord): Contact {
  const f = r.fields;
  return {
    id: r.id,
    fullName: (f['Full Name'] as string) || '',
    email: (f['Email'] as string) || '',
    phone: (f['Phone'] as string) || '',
    status: ((f['Status'] as { name?: string })?.name || (f['Status'] as string)) || '',
    practiceArea: ((f['Practice Area'] as { name?: string })?.name || (f['Practice Area'] as string)) || '',
    source: ((f['Source'] as { name?: string })?.name || (f['Source'] as string)) || '',
    notes: (f['Notes'] as string) || '',
    created: (f['Created'] as string) || '',
  };
}

function mapMatter(r: AirtableRecord): Matter {
  const f = r.fields;
  return {
    id: r.id,
    matterName: (f['Matter Name'] as string) || '',
    clientName: (f['Client Name'] as string) || '',
    status: ((f['Status'] as { name?: string })?.name || (f['Status'] as string)) || '',
    practiceArea: ((f['Practice Area'] as { name?: string })?.name || (f['Practice Area'] as string)) || '',
    openDate: (f['Open Date'] as string) || '',
    closeDate: (f['Close Date'] as string) || '',
    description: (f['Description'] as string) || '',
    billingType: ((f['Billing Type'] as { name?: string })?.name || (f['Billing Type'] as string)) || '',
  };
}

function mapFollowUp(r: AirtableRecord): FollowUp {
  const f = r.fields;
  return {
    id: r.id,
    title: (f['Follow-up Title'] as string) || '',
    contactName: (f['Contact Name'] as string) || '',
    dueDate: (f['Due Date'] as string) || '',
    priority: ((f['Priority'] as { name?: string })?.name || (f['Priority'] as string)) || '',
    status: ((f['Status'] as { name?: string })?.name || (f['Status'] as string)) || '',
    type: ((f['Type'] as { name?: string })?.name || (f['Type'] as string)) || '',
    notes: (f['Notes'] as string) || '',
  };
}

// ── Badge helpers ──────────────────────────────────────────────────────────────
function statusBadge(status: string) {
  const map: Record<string, string> = {
    Active: 'bg-green-100 text-green-700',
    Prospect: 'bg-blue-100 text-blue-700',
    Inactive: 'bg-gray-100 text-gray-600',
    'Former Client': 'bg-orange-100 text-orange-700',
    Open: 'bg-blue-100 text-blue-700',
    'In Progress': 'bg-yellow-100 text-yellow-700',
    Closed: 'bg-green-100 text-green-700',
    'On Hold': 'bg-red-100 text-red-700',
    'Pending Review': 'bg-purple-100 text-purple-700',
    Pending: 'bg-blue-100 text-blue-700',
    Completed: 'bg-green-100 text-green-700',
    Cancelled: 'bg-gray-100 text-gray-600',
  };
  return map[status] || 'bg-gray-100 text-gray-600';
}

function priorityBadge(p: string) {
  if (p === 'High') return 'bg-red-100 text-red-700';
  if (p === 'Medium') return 'bg-yellow-100 text-yellow-700';
  return 'bg-green-100 text-green-700';
}

// ── Modal ──────────────────────────────────────────────────────────────────────
interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

function Modal({ title, onClose, children }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground text-base">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ── Form field ─────────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const inputCls = 'w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors';
const selectCls = `${inputCls} cursor-pointer`;

// ── Contacts Tab ───────────────────────────────────────────────────────────────
function ContactsTab() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', status: 'Prospect', practiceArea: '', source: '', notes: '', created: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await airtableFetch(TABLES.contacts);
      setContacts((data.records as AirtableRecord[]).map(mapContact));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditing(null); setForm({ fullName: '', email: '', phone: '', status: 'Prospect', practiceArea: '', source: '', notes: '', created: '' }); setShowForm(true); };
  const openEdit = (c: Contact) => { setEditing(c); setForm({ fullName: c.fullName, email: c.email, phone: c.phone, status: c.status, practiceArea: c.practiceArea, source: c.source, notes: c.notes, created: c.created }); setShowForm(true); };

  const handleSave = async () => {
    if (!form.fullName.trim()) return;
    setSaving(true);
    try {
      const fields: Record<string, unknown> = {
        'Full Name': form.fullName,
        'Email': form.email,
        'Phone': form.phone,
        'Status': form.status,
        'Practice Area': form.practiceArea,
        'Source': form.source,
        'Notes': form.notes,
      };
      if (form.created) fields['Created'] = form.created;
      if (editing) {
        await airtableUpdate(TABLES.contacts, editing.id, fields);
      } else {
        await airtableFetch(TABLES.contacts, 'POST', { records: [{ fields }] });
      }
      setShowForm(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this contact?')) return;
    try {
      await airtableDelete(TABLES.contacts, id);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const filtered = contacts.filter(c =>
    c.fullName.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    c.practiceArea.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contacts…" className={`${inputCls} max-w-xs`} />
        <button onClick={openAdd} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Contact
        </button>
      </div>

      {error && <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">Loading contacts…</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-3 opacity-40"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          <p className="text-sm">{search ? 'No contacts match your search' : 'No contacts yet — add your first one'}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary/30 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Phone</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Practice Area</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Source</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-secondary/20 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{c.fullName}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.email || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.phone || '—'}</td>
                  <td className="px-4 py-3">
                    {c.status && <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge(c.status)}`}>{c.status}</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.practiceArea || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.source || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(c)} className="text-muted-foreground hover:text-foreground transition-colors">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button onClick={() => handleDelete(c.id)} className="text-muted-foreground hover:text-red-500 transition-colors">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <Modal title={editing ? 'Edit Contact' : 'New Contact'} onClose={() => setShowForm(false)}>
          <Field label="Full Name *">
            <input value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} className={inputCls} placeholder="Jane Smith" />
          </Field>
          <Field label="Email">
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputCls} placeholder="jane@example.com" />
          </Field>
          <Field label="Phone">
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inputCls} placeholder="(555) 000-0000" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Status">
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={selectCls}>
                {['Prospect', 'Active', 'Inactive', 'Former Client'].map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Source">
              <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} className={selectCls}>
                <option value="">— Select —</option>
                {['Referral', 'Website', 'Social Media', 'Calendly', 'Walk-in', 'Other'].map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Practice Area">
            <select value={form.practiceArea} onChange={e => setForm(f => ({ ...f, practiceArea: e.target.value }))} className={selectCls}>
              <option value="">— Select —</option>
              {['Family Law', 'Criminal Defense', 'Personal Injury', 'Business Law', 'Estate Planning', 'Immigration', 'Other'].map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Notes">
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className={`${inputCls} h-24 resize-none`} placeholder="Any notes about this contact…" />
          </Field>
          {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button onClick={handleSave} disabled={saving || !form.fullName.trim()} className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Contact'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Matters Tab ────────────────────────────────────────────────────────────────
function MattersTab() {
  const [matters, setMatters] = useState<Matter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Matter | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ matterName: '', clientName: '', status: 'Open', practiceArea: '', openDate: '', closeDate: '', description: '', billingType: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await airtableFetch(TABLES.matters);
      setMatters((data.records as AirtableRecord[]).map(mapMatter));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditing(null); setForm({ matterName: '', clientName: '', status: 'Open', practiceArea: '', openDate: '', closeDate: '', description: '', billingType: '' }); setShowForm(true); };
  const openEdit = (m: Matter) => { setEditing(m); setForm({ matterName: m.matterName, clientName: m.clientName, status: m.status, practiceArea: m.practiceArea, openDate: m.openDate, closeDate: m.closeDate, description: m.description, billingType: m.billingType }); setShowForm(true); };

  const handleSave = async () => {
    if (!form.matterName.trim()) return;
    setSaving(true);
    try {
      const fields: Record<string, unknown> = {
        'Matter Name': form.matterName,
        'Client Name': form.clientName,
        'Status': form.status,
        'Practice Area': form.practiceArea,
        'Description': form.description,
        'Billing Type': form.billingType,
      };
      if (form.openDate) fields['Open Date'] = form.openDate;
      if (form.closeDate) fields['Close Date'] = form.closeDate;
      if (editing) {
        await airtableUpdate(TABLES.matters, editing.id, fields);
      } else {
        await airtableFetch(TABLES.matters, 'POST', { records: [{ fields }] });
      }
      setShowForm(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this matter?')) return;
    try {
      await airtableDelete(TABLES.matters, id);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const filtered = matters.filter(m =>
    m.matterName.toLowerCase().includes(search.toLowerCase()) ||
    m.clientName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search matters…" className={`${inputCls} max-w-xs`} />
        <button onClick={openAdd} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Matter
        </button>
      </div>

      {error && <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">Loading matters…</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-3 opacity-40"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <p className="text-sm">{search ? 'No matters match your search' : 'No matters yet — add your first one'}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary/30 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Matter</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Client</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Practice Area</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Billing</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Opened</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(m => (
                <tr key={m.id} className="hover:bg-secondary/20 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{m.matterName}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.clientName || '—'}</td>
                  <td className="px-4 py-3">
                    {m.status && <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge(m.status)}`}>{m.status}</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{m.practiceArea || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.billingType || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.openDate || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(m)} className="text-muted-foreground hover:text-foreground transition-colors">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button onClick={() => handleDelete(m.id)} className="text-muted-foreground hover:text-red-500 transition-colors">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <Modal title={editing ? 'Edit Matter' : 'New Matter'} onClose={() => setShowForm(false)}>
          <Field label="Matter Name *">
            <input value={form.matterName} onChange={e => setForm(f => ({ ...f, matterName: e.target.value }))} className={inputCls} placeholder="Smith v. Jones — Divorce" />
          </Field>
          <Field label="Client Name">
            <input value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))} className={inputCls} placeholder="Jane Smith" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Status">
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={selectCls}>
                {['Open', 'In Progress', 'Pending Review', 'On Hold', 'Closed'].map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Billing Type">
              <select value={form.billingType} onChange={e => setForm(f => ({ ...f, billingType: e.target.value }))} className={selectCls}>
                <option value="">— Select —</option>
                {['Hourly', 'Flat Fee', 'Retainer', 'Contingency'].map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Practice Area">
            <select value={form.practiceArea} onChange={e => setForm(f => ({ ...f, practiceArea: e.target.value }))} className={selectCls}>
              <option value="">— Select —</option>
              {['Family Law', 'Criminal Defense', 'Personal Injury', 'Business Law', 'Estate Planning', 'Immigration', 'Other'].map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Open Date">
              <input type="date" value={form.openDate} onChange={e => setForm(f => ({ ...f, openDate: e.target.value }))} className={inputCls} />
            </Field>
            <Field label="Close Date">
              <input type="date" value={form.closeDate} onChange={e => setForm(f => ({ ...f, closeDate: e.target.value }))} className={inputCls} />
            </Field>
          </div>
          <Field label="Description">
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={`${inputCls} h-24 resize-none`} placeholder="Brief description of this matter…" />
          </Field>
          {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button onClick={handleSave} disabled={saving || !form.matterName.trim()} className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Matter'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Follow-ups Tab ─────────────────────────────────────────────────────────────
function FollowUpsTab() {
  const [followups, setFollowups] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<FollowUp | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', contactName: '', dueDate: '', priority: 'Medium', status: 'Pending', type: '', notes: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await airtableFetch(TABLES.followups);
      setFollowups((data.records as AirtableRecord[]).map(mapFollowUp));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditing(null); setForm({ title: '', contactName: '', dueDate: '', priority: 'Medium', status: 'Pending', type: '', notes: '' }); setShowForm(true); };
  const openEdit = (fu: FollowUp) => { setEditing(fu); setForm({ title: fu.title, contactName: fu.contactName, dueDate: fu.dueDate, priority: fu.priority, status: fu.status, type: fu.type, notes: fu.notes }); setShowForm(true); };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const fields: Record<string, unknown> = {
        'Follow-up Title': form.title,
        'Contact Name': form.contactName,
        'Priority': form.priority,
        'Status': form.status,
        'Type': form.type,
        'Notes': form.notes,
      };
      if (form.dueDate) fields['Due Date'] = form.dueDate;
      if (editing) {
        await airtableUpdate(TABLES.followups, editing.id, fields);
      } else {
        await airtableFetch(TABLES.followups, 'POST', { records: [{ fields }] });
      }
      setShowForm(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this follow-up?')) return;
    try {
      await airtableDelete(TABLES.followups, id);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleMarkComplete = async (fu: FollowUp) => {
    try {
      await airtableUpdate(TABLES.followups, fu.id, { 'Status': 'Completed' });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const filtered = followups.filter(fu => {
    const matchSearch = fu.title.toLowerCase().includes(search.toLowerCase()) || fu.contactName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filterStatus || fu.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const overdue = filtered.filter(fu => fu.dueDate && new Date(fu.dueDate) < new Date() && fu.status !== 'Completed' && fu.status !== 'Cancelled');
  const upcoming = filtered.filter(fu => !overdue.includes(fu) && fu.status !== 'Completed' && fu.status !== 'Cancelled');
  const done = filtered.filter(fu => fu.status === 'Completed' || fu.status === 'Cancelled');

  const FollowUpRow = ({ fu }: { fu: FollowUp }) => (
    <tr className="hover:bg-secondary/20 transition-colors">
      <td className="px-4 py-3">
        <div className="font-medium text-foreground text-sm">{fu.title}</div>
        {fu.contactName && <div className="text-xs text-muted-foreground mt-0.5">{fu.contactName}</div>}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{fu.type || '—'}</td>
      <td className="px-4 py-3">
        {fu.dueDate && (
          <span className={`text-xs font-medium ${new Date(fu.dueDate) < new Date() && fu.status !== 'Completed' ? 'text-red-600' : 'text-muted-foreground'}`}>
            {fu.dueDate}
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        {fu.priority && <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${priorityBadge(fu.priority)}`}>{fu.priority}</span>}
      </td>
      <td className="px-4 py-3">
        {fu.status && <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge(fu.status)}`}>{fu.status}</span>}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {fu.status !== 'Completed' && fu.status !== 'Cancelled' && (
            <button onClick={() => handleMarkComplete(fu)} title="Mark complete" className="text-muted-foreground hover:text-green-600 transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
            </button>
          )}
          <button onClick={() => openEdit(fu)} className="text-muted-foreground hover:text-foreground transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button onClick={() => handleDelete(fu.id)} className="text-muted-foreground hover:text-red-500 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
      </td>
    </tr>
  );

  const TableHead = () => (
    <thead>
      <tr className="bg-secondary/30 text-left">
        <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Task</th>
        <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
        <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Due</th>
        <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Priority</th>
        <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
        <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider"></th>
      </tr>
    </thead>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search follow-ups…" className={`${inputCls} max-w-xs`} />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={`${selectCls} w-36`}>
            <option value="">All Statuses</option>
            {['Pending', 'In Progress', 'Completed', 'Cancelled'].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <button onClick={openAdd} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Follow-up
        </button>
      </div>

      {error && <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">Loading follow-ups…</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-3 opacity-40"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
          <p className="text-sm">{search || filterStatus ? 'No follow-ups match your filters' : 'No follow-ups yet — add your first one'}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {overdue.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                Overdue ({overdue.length})
              </h4>
              <div className="overflow-x-auto rounded-xl border border-red-200">
                <table className="w-full text-sm"><TableHead /><tbody className="divide-y divide-border">{overdue.map(fu => <FollowUpRow key={fu.id} fu={fu} />)}</tbody></table>
              </div>
            </div>
          )}
          {upcoming.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Upcoming ({upcoming.length})</h4>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm"><TableHead /><tbody className="divide-y divide-border">{upcoming.map(fu => <FollowUpRow key={fu.id} fu={fu} />)}</tbody></table>
              </div>
            </div>
          )}
          {done.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Completed / Cancelled ({done.length})</h4>
              <div className="overflow-x-auto rounded-xl border border-border opacity-70">
                <table className="w-full text-sm"><TableHead /><tbody className="divide-y divide-border">{done.map(fu => <FollowUpRow key={fu.id} fu={fu} />)}</tbody></table>
              </div>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <Modal title={editing ? 'Edit Follow-up' : 'New Follow-up'} onClose={() => setShowForm(false)}>
          <Field label="Title *">
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inputCls} placeholder="Call Jane re: discovery docs" />
          </Field>
          <Field label="Contact Name">
            <input value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} className={inputCls} placeholder="Jane Smith" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Type">
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={selectCls}>
                <option value="">— Select —</option>
                {['Call', 'Email', 'Meeting', 'Document Review', 'Court Date', 'Other'].map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Due Date">
              <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} className={inputCls} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Priority">
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className={selectCls}>
                {['High', 'Medium', 'Low'].map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={selectCls}>
                {['Pending', 'In Progress', 'Completed', 'Cancelled'].map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Notes">
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className={`${inputCls} h-20 resize-none`} placeholder="Any notes…" />
          </Field>
          {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button onClick={handleSave} disabled={saving || !form.title.trim()} className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Follow-up'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
type CRMTab = 'contacts' | 'matters' | 'followups';

export default function AirtableCRMDashboard() {
  const [activeTab, setActiveTab] = useState<CRMTab>('contacts');

  const tabs: { id: CRMTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'contacts',
      label: 'Contacts',
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    },
    {
      id: 'matters',
      label: 'Matters',
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
    },
    {
      id: 'followups',
      label: 'Follow-ups',
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/><line x1="8" y1="14" x2="8" y2="14"/><line x1="12" y1="14" x2="12" y2="14"/><line x1="16" y1="14" x2="16" y2="14"/></svg>,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>
        <div>
          <h2 className="font-semibold text-foreground text-base">Airtable CRM</h2>
          <p className="text-xs text-muted-foreground">Lexi Leads CRM — contacts, matters & follow-ups</p>
        </div>
        <a
          href="https://airtable.com/app6Tk6mUPY4K4ydc"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          Open in Airtable
        </a>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-border pb-0">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className={activeTab === tab.id ? 'text-primary' : 'opacity-60'}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'contacts' && <ContactsTab />}
        {activeTab === 'matters' && <MattersTab />}
        {activeTab === 'followups' && <FollowUpsTab />}
      </div>
    </div>
  );
}
