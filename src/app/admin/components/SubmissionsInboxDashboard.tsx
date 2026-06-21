'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContactSubmission {
  id: string;
  name: string;
  firm: string;
  email: string;
  service: string;
  message: string;
  status: string;
  notes: string | null;
  created_at: string;
}

interface LexiSession {
  id: string;
  session_key: string;
  client_name: string;
  case_ref: string | null;
  case_summary: string | null;
  total_hours_logged: number;
  conversation_history: Array<{ role: string; content: string }>;
  last_activity_at: string;
  created_at: string;
}

type ActiveView = 'contact' | 'lexi';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(d: string) {
  return new Date(d).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700 border-blue-200',
  in_review: 'bg-amber-100 text-amber-700 border-amber-200',
  contacted: 'bg-green-100 text-green-700 border-green-200',
  closed: 'bg-gray-100 text-gray-500 border-gray-200',
};

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  in_review: 'In Review',
  contacted: 'Contacted',
  closed: 'Closed',
};

// ─── Contact Submissions Panel ────────────────────────────────────────────────

function ContactSubmissionsPanel() {
  const supabase = createClient();
  const [submissions, setSubmissions] = useState<ContactSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ContactSubmission | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [filterService, setFilterService] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('contact_inquiries')
        .select('id, name, firm, email, service, message, status, notes, created_at')
        .order('created_at', { ascending: false });
      if (err) throw err;
      setSubmissions(data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load submissions');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  const serviceOptions = Array.from(new Set(submissions.map((s) => s.service).filter(Boolean))).sort();

  const filtered = submissions.filter((s) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      s.name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      s.firm.toLowerCase().includes(q) ||
      s.message.toLowerCase().includes(q);
    const matchService = filterService === 'all' || s.service === filterService;
    const matchStatus = filterStatus === 'all' || s.status === filterStatus;
    const createdAt = new Date(s.created_at);
    const matchFrom = !filterDateFrom || createdAt >= new Date(filterDateFrom);
    const matchTo = !filterDateTo || createdAt <= new Date(filterDateTo + 'T23:59:59');
    return matchSearch && matchService && matchStatus && matchFrom && matchTo;
  });

  return (
    <div className="flex gap-6 h-full">
      {/* Left: List */}
      <div className="flex-1 min-w-0 flex flex-col gap-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[180px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="Search name, email, firm, message…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-border bg-input text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>
          <select
            value={filterService}
            onChange={(e) => setFilterService(e.target.value)}
            className="px-3 py-2 rounded-xl border border-border bg-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
          >
            <option value="all">All Services</option>
            {serviceOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 rounded-xl border border-border bg-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
          >
            <option value="all">All Statuses</option>
            <option value="new">New</option>
            <option value="in_review">In Review</option>
            <option value="contacted">Contacted</option>
            <option value="closed">Closed</option>
          </select>
          <input
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            className="px-3 py-2 rounded-xl border border-border bg-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
            title="From date"
          />
          <input
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            className="px-3 py-2 rounded-xl border border-border bg-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
            title="To date"
          />
          {(search || filterService !== 'all' || filterStatus !== 'all' || filterDateFrom || filterDateTo) && (
            <button
              onClick={() => { setSearch(''); setFilterService('all'); setFilterStatus('all'); setFilterDateFrom(''); setFilterDateTo(''); }}
              className="px-3 py-2 rounded-xl border border-border bg-secondary/40 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* Count */}
        <p className="text-xs text-muted-foreground">
          {loading ? 'Loading…' : `${filtered.length} submission${filtered.length !== 1 ? 's' : ''}`}
        </p>

        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
        )}

        {/* List */}
        <div className="flex flex-col gap-2">
          {!loading && filtered.length === 0 && (
            <div className="py-12 text-center text-muted-foreground text-sm">No submissions found.</div>
          )}
          {filtered.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelected(selected?.id === s.id ? null : s)}
              className={`w-full text-left p-4 rounded-2xl border transition-all ${
                selected?.id === s.id
                  ? 'border-primary/40 bg-primary/5' :'border-border bg-card hover:border-primary/20 hover:bg-secondary/20'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-foreground">{s.name}</span>
                    {s.firm && <span className="text-xs text-muted-foreground">· {s.firm}</span>}
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_COLORS[s.status] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                      {STATUS_LABELS[s.status] ?? s.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.email}</p>
                  <p className="text-xs text-primary/80 font-medium mt-1">{s.service}</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.message}</p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">{formatDate(s.created_at)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right: Detail */}
      {selected && (
        <div className="w-80 flex-shrink-0 bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 self-start sticky top-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-serif text-lg text-foreground leading-tight">{selected.name}</h3>
            <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground text-xs uppercase tracking-widest font-semibold">Email</span>
              <a href={`mailto:${selected.email}`} className="text-primary text-xs hover:underline truncate max-w-[160px]">{selected.email}</a>
            </div>
            {selected.firm && (
              <div className="flex justify-between">
                <span className="text-muted-foreground text-xs uppercase tracking-widest font-semibold">Firm</span>
                <span className="text-xs text-foreground">{selected.firm}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground text-xs uppercase tracking-widest font-semibold">Service</span>
              <span className="text-xs text-foreground font-medium">{selected.service}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground text-xs uppercase tracking-widest font-semibold">Status</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_COLORS[selected.status] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                {STATUS_LABELS[selected.status] ?? selected.status}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground text-xs uppercase tracking-widest font-semibold">Submitted</span>
              <span className="text-xs text-foreground">{formatDateTime(selected.created_at)}</span>
            </div>
          </div>

          <div className="border-t border-border pt-3">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Message</p>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{selected.message}</p>
          </div>

          {selected.notes && (
            <div className="border-t border-border pt-3">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Notes</p>
              <p className="text-sm text-foreground leading-relaxed">{selected.notes}</p>
            </div>
          )}

          <a
            href={`mailto:${selected.email}?subject=Re: Your Inquiry — Broussard Legal Services`}
            className="mt-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-widest text-white transition-all hover:opacity-90"
            style={{ background: '#355E3B' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
            Reply via Email
          </a>
        </div>
      )}
    </div>
  );
}

// ─── Lexi Conversations Panel ─────────────────────────────────────────────────

function LexiConversationsPanel() {
  const supabase = createClient();
  const [sessions, setSessions] = useState<LexiSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<LexiSession | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterCaseRef, setFilterCaseRef] = useState('all');

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('lexi_case_sessions')
        .select('id, session_key, client_name, case_ref, case_summary, total_hours_logged, conversation_history, last_activity_at, created_at')
        .order('last_activity_at', { ascending: false });
      if (err) throw err;
      setSessions(data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load Lexi sessions');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const caseRefOptions = Array.from(new Set(sessions.map((s) => s.case_ref).filter(Boolean) as string[])).sort();

  const filtered = sessions.filter((s) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      s.client_name.toLowerCase().includes(q) ||
      (s.case_ref ?? '').toLowerCase().includes(q) ||
      (s.case_summary ?? '').toLowerCase().includes(q);
    const matchCaseRef = filterCaseRef === 'all' || s.case_ref === filterCaseRef;
    const lastActivity = new Date(s.last_activity_at);
    const matchFrom = !filterDateFrom || lastActivity >= new Date(filterDateFrom);
    const matchTo = !filterDateTo || lastActivity <= new Date(filterDateTo + 'T23:59:59');
    return matchSearch && matchCaseRef && matchFrom && matchTo;
  });

  return (
    <div className="flex gap-6 h-full">
      {/* Left: List */}
      <div className="flex-1 min-w-0 flex flex-col gap-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[180px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="Search client, case ref, summary…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-border bg-input text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>
          {caseRefOptions.length > 0 && (
            <select
              value={filterCaseRef}
              onChange={(e) => setFilterCaseRef(e.target.value)}
              className="px-3 py-2 rounded-xl border border-border bg-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
            >
              <option value="all">All Cases</option>
              {caseRefOptions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          )}
          <input
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            className="px-3 py-2 rounded-xl border border-border bg-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
            title="From date"
          />
          <input
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            className="px-3 py-2 rounded-xl border border-border bg-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
            title="To date"
          />
          {(search || filterCaseRef !== 'all' || filterDateFrom || filterDateTo) && (
            <button
              onClick={() => { setSearch(''); setFilterCaseRef('all'); setFilterDateFrom(''); setFilterDateTo(''); }}
              className="px-3 py-2 rounded-xl border border-border bg-secondary/40 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          {loading ? 'Loading…' : `${filtered.length} session${filtered.length !== 1 ? 's' : ''}`}
        </p>

        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
        )}

        <div className="flex flex-col gap-2">
          {!loading && filtered.length === 0 && (
            <div className="py-12 text-center text-muted-foreground text-sm">No Lexi sessions found.</div>
          )}
          {filtered.map((s) => {
            const msgCount = Array.isArray(s.conversation_history) ? s.conversation_history.length : 0;
            return (
              <button
                key={s.id}
                onClick={() => setSelected(selected?.id === s.id ? null : s)}
                className={`w-full text-left p-4 rounded-2xl border transition-all ${
                  selected?.id === s.id
                    ? 'border-primary/40 bg-primary/5' :'border-border bg-card hover:border-primary/20 hover:bg-secondary/20'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-foreground">{s.client_name}</span>
                      {s.case_ref && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-violet-100 text-violet-700 border-violet-200">
                          {s.case_ref}
                        </span>
                      )}
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-emerald-100 text-emerald-700 border-emerald-200">
                        {msgCount} msg{msgCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {s.case_summary && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.case_summary}</p>
                    )}
                    {s.total_hours_logged > 0 && (
                      <p className="text-xs text-primary/80 font-medium mt-1">{s.total_hours_logged}h logged</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">{formatDate(s.last_activity_at)}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Conversation Detail */}
      {selected && (
        <div className="w-96 flex-shrink-0 bg-card border border-border rounded-2xl flex flex-col self-start sticky top-4 max-h-[80vh] overflow-hidden">
          {/* Header */}
          <div className="p-5 border-b border-border flex items-start justify-between gap-2">
            <div>
              <h3 className="font-serif text-lg text-foreground leading-tight">{selected.client_name}</h3>
              {selected.case_ref && (
                <p className="text-xs text-muted-foreground mt-0.5">Case: {selected.case_ref}</p>
              )}
              <p className="text-xs text-muted-foreground mt-0.5">Last active: {formatDateTime(selected.last_activity_at)}</p>
            </div>
            <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 mt-1">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Summary */}
          {selected.case_summary && (
            <div className="px-5 py-3 bg-secondary/20 border-b border-border">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Case Summary</p>
              <p className="text-xs text-foreground leading-relaxed">{selected.case_summary}</p>
            </div>
          )}

          {/* Stats row */}
          <div className="px-5 py-3 border-b border-border flex gap-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">Messages</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">
                {Array.isArray(selected.conversation_history) ? selected.conversation_history.length : 0}
              </p>
            </div>
            {selected.total_hours_logged > 0 && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">Hours Logged</p>
                <p className="text-sm font-semibold text-foreground mt-0.5">{selected.total_hours_logged}h</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">Created</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">{formatDate(selected.created_at)}</p>
            </div>
          </div>

          {/* Conversation */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {!Array.isArray(selected.conversation_history) || selected.conversation_history.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No conversation history.</p>
            ) : (
              selected.conversation_history.map((msg, i) => {
                const isUser = msg.role === 'user';
                return (
                  <div key={i} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                        isUser
                          ? 'bg-primary text-primary-foreground rounded-br-sm'
                          : 'bg-secondary text-foreground rounded-bl-sm'
                      }`}
                    >
                      <p className={`text-[10px] font-semibold uppercase tracking-widest mb-1 ${isUser ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                        {isUser ? 'User' : 'Lexi'}
                      </p>
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SubmissionsInboxDashboard() {
  const [activeView, setActiveView] = useState<ActiveView>('contact');

  return (
    <div className="space-y-6">
      {/* View Toggle */}
      <div className="flex items-center gap-1 p-1 bg-secondary/40 rounded-2xl w-fit border border-border">
        {([
          { id: 'contact' as const, label: 'Contact Form Submissions', icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
            </svg>
          )},
          { id: 'lexi' as const, label: 'Lexi Conversation History', icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          )},
        ] as const).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveView(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all ${
              activeView === tab.id
                ? 'bg-card text-foreground shadow-sm border border-border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className={activeView === tab.id ? 'text-primary' : 'opacity-60'}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Panel */}
      {activeView === 'contact' && <ContactSubmissionsPanel />}
      {activeView === 'lexi' && <LexiConversationsPanel />}
    </div>
  );
}
