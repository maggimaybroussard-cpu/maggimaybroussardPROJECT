'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RoutingRule {
  id: string;
  practice_area: string;
  attorney_name: string;
  attorney_email: string;
  is_active: boolean;
  priority: number;
  fallback_email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface CaseRecord {
  id: string;
  client_name: string;
  client_email: string;
  client_phone: string | null;
  firm_name: string | null;
  practice_area: string;
  matter_title: string;
  matter_description: string;
  opposing_party: string | null;
  urgency: string;
  assigned_attorney: string | null;
  assigned_attorney_email: string | null;
  status: string;
  source: string;
  created_at: string;
}

type ActiveTab = 'rules' | 'cases';

const URGENCY_COLORS: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700 border-red-200',
  priority: 'bg-amber-100 text-amber-700 border-amber-200',
  standard: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  closed: 'bg-secondary text-muted-foreground',
};

// ─── Routing Rules Tab ────────────────────────────────────────────────────────

function RoutingRulesTab() {
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [newRule, setNewRule] = useState({
    practice_area: '',
    attorney_name: '',
    attorney_email: '',
    priority: 1,
    fallback_email: '',
    notes: '',
    is_active: true,
  });
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('intake_routing_rules')
      .select('*')
      .order('practice_area', { ascending: true })
      .order('priority', { ascending: true });
    setRules(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const updateRule = async (id: string, field: keyof RoutingRule, value: string | boolean | number) => {
    setRules((prev) => prev.map((r) => r.id === id ? { ...r, [field]: value } : r));
  };

  const saveRule = async (rule: RoutingRule) => {
    setSaving(rule.id);
    const { error } = await supabase
      .from('intake_routing_rules')
      .update({
        practice_area: rule.practice_area,
        attorney_name: rule.attorney_name,
        attorney_email: rule.attorney_email,
        is_active: rule.is_active,
        priority: rule.priority,
        fallback_email: rule.fallback_email || null,
        notes: rule.notes || null,
      })
      .eq('id', rule.id);
    setSaving(null);
    if (!error) {
      setSaveMsg(`Saved "${rule.practice_area}"`);
      setTimeout(() => setSaveMsg(null), 2500);
    }
  };

  const deleteRule = async (id: string) => {
    if (!confirm('Delete this routing rule?')) return;
    await supabase.from('intake_routing_rules').delete().eq('id', id);
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  const createRule = async () => {
    if (!newRule.practice_area || !newRule.attorney_name || !newRule.attorney_email) return;
    const { data, error } = await supabase
      .from('intake_routing_rules')
      .insert({
        practice_area: newRule.practice_area,
        attorney_name: newRule.attorney_name,
        attorney_email: newRule.attorney_email,
        priority: newRule.priority,
        fallback_email: newRule.fallback_email || null,
        notes: newRule.notes || null,
        is_active: newRule.is_active,
      })
      .select('*')
      .single();
    if (!error && data) {
      setRules((prev) => [...prev, data]);
      setNewRule({ practice_area: '', attorney_name: '', attorney_email: '', priority: 1, fallback_email: '', notes: '', is_active: true });
      setAddingNew(false);
      setSaveMsg('New routing rule created');
      setTimeout(() => setSaveMsg(null), 2500);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-sm text-muted-foreground">
            Map each practice area to the attorney who should receive routed intakes.
            The first active rule matching the intake&apos;s service type is used.
          </p>
        </div>
        <button
          onClick={() => setAddingNew(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold uppercase tracking-widest hover:opacity-90 transition-all shrink-0"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add Rule
        </button>
      </div>

      {saveMsg && (
        <div className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          {saveMsg}
        </div>
      )}

      {/* New rule form */}
      {addingNew && (
        <div className="mb-5 rounded-xl border border-primary/30 bg-primary/5 p-5">
          <p className="text-sm font-semibold text-foreground mb-4">New Routing Rule</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Practice Area *</label>
              <input
                type="text"
                value={newRule.practice_area}
                onChange={(e) => setNewRule((p) => ({ ...p, practice_area: e.target.value }))}
                placeholder="e.g. Litigation Support"
                className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Attorney Name *</label>
              <input
                type="text"
                value={newRule.attorney_name}
                onChange={(e) => setNewRule((p) => ({ ...p, attorney_name: e.target.value }))}
                placeholder="Full name"
                className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Attorney Email *</label>
              <input
                type="email"
                value={newRule.attorney_email}
                onChange={(e) => setNewRule((p) => ({ ...p, attorney_email: e.target.value }))}
                placeholder="attorney@firm.com"
                className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Priority</label>
              <input
                type="number"
                min={1}
                max={99}
                value={newRule.priority}
                onChange={(e) => setNewRule((p) => ({ ...p, priority: parseInt(e.target.value) || 1 }))}
                className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Fallback Email</label>
              <input
                type="email"
                value={newRule.fallback_email}
                onChange={(e) => setNewRule((p) => ({ ...p, fallback_email: e.target.value }))}
                placeholder="fallback@firm.com (optional)"
                className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Notes</label>
              <input
                type="text"
                value={newRule.notes}
                onChange={(e) => setNewRule((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Optional notes"
                className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={createRule}
              disabled={!newRule.practice_area || !newRule.attorney_name || !newRule.attorney_email}
              className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-40"
            >
              Create Rule
            </button>
            <button
              onClick={() => setAddingNew(false)}
              className="px-5 py-2 border border-border rounded-lg text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:bg-secondary/40 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Rules table */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Practice Area</th>
              <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Attorney</th>
              <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden md:table-cell">Email</th>
              <th className="text-center px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Priority</th>
              <th className="text-center px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Active</th>
              <th className="text-right px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rules.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No routing rules yet. Add one above to start auto-routing intakes.
                </td>
              </tr>
            ) : (
              rules.map((rule, i) => (
                <tr key={rule.id} className={`border-b border-border last:border-0 ${i % 2 === 0 ? 'bg-background' : 'bg-secondary/10'}`}>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={rule.practice_area}
                      onChange={(e) => updateRule(rule.id, 'practice_area', e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-input text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent/40 min-w-[140px]"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={rule.attorney_name}
                      onChange={(e) => updateRule(rule.id, 'attorney_name', e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-input text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent/40 min-w-[140px]"
                    />
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <input
                      type="email"
                      value={rule.attorney_email}
                      onChange={(e) => updateRule(rule.id, 'attorney_email', e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-input text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent/40 min-w-[180px]"
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={rule.priority}
                      onChange={(e) => updateRule(rule.id, 'priority', parseInt(e.target.value) || 1)}
                      className="w-14 px-2 py-1.5 rounded-lg border border-border bg-input text-foreground text-xs text-center focus:outline-none focus:ring-2 focus:ring-accent/40"
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => updateRule(rule.id, 'is_active', !rule.is_active)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${rule.is_active ? 'bg-primary' : 'bg-border'}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${rule.is_active ? 'translate-x-4' : 'translate-x-1'}`} />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => saveRule(rule)}
                        disabled={saving === rule.id}
                        className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-[10px] font-semibold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
                      >
                        {saving === rule.id ? '...' : 'Save'}
                      </button>
                      <button
                        onClick={() => deleteRule(rule.id)}
                        className="p-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                        title="Delete rule"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-4 p-4 rounded-xl bg-secondary/30 border border-border">
        <p className="text-xs font-semibold text-foreground mb-2">How Routing Works</p>
        <ul className="space-y-1">
          <li className="text-xs text-muted-foreground">&#8226; When an intake is submitted, the system finds the active rule whose <strong>Practice Area</strong> matches the intake&apos;s service type (case-insensitive).</li>
          <li className="text-xs text-muted-foreground">&#8226; If multiple rules match, the one with the lowest <strong>Priority</strong> number wins.</li>
          <li className="text-xs text-muted-foreground">&#8226; If no match is found, the <strong>General Inquiry</strong> rule is used as a fallback.</li>
          <li className="text-xs text-muted-foreground">&#8226; The matched attorney receives a routing notification email; the client receives a confirmation email with their case reference number.</li>
        </ul>
      </div>
    </div>
  );
}

// ─── Case Records Tab ─────────────────────────────────────────────────────────

function CaseRecordsTab() {
  const [records, setRecords] = useState<CaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [urgencyFilter, setUrgencyFilter] = useState('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('intake_case_records')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    setRecords(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('intake_case_records').update({ status }).eq('id', id);
    setRecords((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
  };

  const filtered = records.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch = !q || r.client_name.toLowerCase().includes(q) || r.client_email.toLowerCase().includes(q) || r.practice_area.toLowerCase().includes(q) || r.matter_title.toLowerCase().includes(q) || (r.assigned_attorney ?? '').toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchUrgency = urgencyFilter === 'all' || r.urgency === urgencyFilter;
    return matchSearch && matchStatus && matchUrgency;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search client, matter, attorney…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
        >
          <option value="all">All Statuses</option>
          <option value="new">New</option>
          <option value="in_progress">In Progress</option>
          <option value="closed">Closed</option>
        </select>
        <select
          value={urgencyFilter}
          onChange={(e) => setUrgencyFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
        >
          <option value="all">All Urgency</option>
          <option value="urgent">Urgent</option>
          <option value="priority">Priority</option>
          <option value="standard">Standard</option>
        </select>
        <span className="text-xs text-muted-foreground shrink-0">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          {records.length === 0
            ? 'No case records yet. They will appear here after intake submissions are processed.' :'No records match your filters.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((record) => (
            <div key={record.id} className="rounded-xl border border-border bg-card overflow-hidden">
              {/* Row header */}
              <button
                onClick={() => setExpanded(expanded === record.id ? null : record.id)}
                className="w-full flex items-start gap-4 px-5 py-4 hover:bg-secondary/20 transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-foreground">{record.client_name}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${URGENCY_COLORS[record.urgency] ?? URGENCY_COLORS.standard}`}>
                      {record.urgency}
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[record.status] ?? 'bg-secondary text-muted-foreground'}`}>
                      {record.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{record.matter_title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <span className="font-medium text-foreground">{record.practice_area}</span>
                    {record.assigned_attorney && <span> &bull; Assigned: {record.assigned_attorney}</span>}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-muted-foreground font-mono">{record.id.slice(0, 8).toUpperCase()}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {new Date(record.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <svg
                  width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className={`text-muted-foreground transition-transform shrink-0 mt-1 ${expanded === record.id ? 'rotate-180' : ''}`}
                >
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>

              {/* Expanded details */}
              {expanded === record.id && (
                <div className="border-t border-border bg-secondary/5 px-5 py-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Client Email</p>
                      <p className="text-sm text-foreground">{record.client_email}</p>
                    </div>
                    {record.client_phone && (
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Phone</p>
                        <p className="text-sm text-foreground">{record.client_phone}</p>
                      </div>
                    )}
                    {record.firm_name && (
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Firm / Company</p>
                        <p className="text-sm text-foreground">{record.firm_name}</p>
                      </div>
                    )}
                    {record.opposing_party && (
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Opposing Party</p>
                        <p className="text-sm text-foreground">{record.opposing_party}</p>
                      </div>
                    )}
                    {record.assigned_attorney_email && (
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Attorney Email</p>
                        <p className="text-sm text-foreground">{record.assigned_attorney_email}</p>
                      </div>
                    )}
                  </div>
                  {record.matter_description && (
                    <div className="mb-4">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Matter Description</p>
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{record.matter_description}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold shrink-0">Status:</label>
                    <select
                      value={record.status}
                      onChange={(e) => updateStatus(record.id, e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg border border-border bg-input text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent/40"
                    >
                      <option value="new">New</option>
                      <option value="in_progress">In Progress</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function IntakeRoutingDashboard() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('rules');

  const tabs: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'rules',
      label: 'Routing Rules',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
      ),
    },
    {
      id: 'cases',
      label: 'Pre-Populated Cases',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
        <svg className="text-primary shrink-0 mt-0.5" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <div>
          <p className="text-sm font-semibold text-foreground mb-0.5">Intake Auto-Routing Active</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            New intake submissions are automatically routed to the matching attorney based on practice area.
            The client receives a branded confirmation email with their case reference number, and the assigned attorney
            receives a routing notification with full client and matter details.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-widest transition-all rounded-t-lg relative ${
              activeTab === tab.id
                ? 'text-foreground bg-secondary/40'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/20'
            }`}
          >
            <span className={activeTab === tab.id ? 'text-primary' : 'opacity-60'}>{tab.icon}</span>
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-primary" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'rules' && <RoutingRulesTab />}
        {activeTab === 'cases' && <CaseRecordsTab />}
      </div>
    </div>
  );
}
