'use client';

import React, { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  priority: number;
  priorityLabel: string;
  status: string;
  statusType: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  assignee?: { id: string; name: string };
  labels: { nodes: Array<{ id: string; name: string; color: string }> };
}

interface BugReportForm {
  title: string;
  description: string;
  priority: number;
  errorType: string;
  pageUrl: string;
  steps: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LINEAR_TEAM_ID = 'adf3c400-28c9-43bd-9a78-2f7b6a302a1c';
const LINEAR_GRAPHQL = 'https://api.linear.app/graphql';

const PRIORITY_MAP: Record<number, { label: string; color: string; icon: string }> = {
  0: { label: 'No priority', color: 'text-muted-foreground', icon: '—' },
  1: { label: 'Urgent', color: 'text-red-500', icon: '🔴' },
  2: { label: 'High', color: 'text-orange-500', icon: '🟠' },
  3: { label: 'Medium', color: 'text-yellow-500', icon: '🟡' },
  4: { label: 'Low', color: 'text-blue-400', icon: '🔵' },
};

const STATUS_COLORS: Record<string, string> = {
  backlog: 'bg-gray-400',
  unstarted: 'bg-slate-400',
  started: 'bg-blue-500',
  completed: 'bg-green-500',
  cancelled: 'bg-red-400',
};

const ERROR_TYPES = [
  'UI / Display Bug',
  'API / Integration Error',
  'Authentication Issue',
  'Payment / Billing Error',
  'Performance Issue',
  'Data Sync Error',
  'Email / Notification Failure',
  'Document / File Error',
  'Other',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function linearQuery(apiKey: string, query: string, variables?: Record<string, unknown>) {
  const res = await fetch(LINEAR_GRAPHQL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: apiKey },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Linear API error: ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0]?.message ?? 'GraphQL error');
  return json.data;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminBugBoardDashboard() {
  const [apiKey, setApiKey] = useState('');
  const [savedKey, setSavedKey] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState('');

  const [issues, setIssues] = useState<LinearIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<BugReportForm>({
    title: '',
    description: '',
    priority: 2,
    errorType: 'UI / Display Bug',
    pageUrl: '',
    steps: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [submitError, setSubmitError] = useState('');

  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Load saved key
  useEffect(() => {
    const stored = localStorage.getItem('linear_api_key');
    if (stored) { setSavedKey(stored); setApiKey(stored); }
  }, []);

  const fetchIssues = useCallback(async (key: string) => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await linearQuery(key, `
        query TeamIssues($teamId: String!) {
          team(id: $teamId) {
            issues(first: 100, orderBy: updatedAt) {
              nodes {
                id identifier title description priority priorityLabel url createdAt updatedAt
                state { name type }
                assignee { id name }
                labels { nodes { id name color } }
              }
            }
          }
        }
      `, { teamId: LINEAR_TEAM_ID });
      const raw = data.team?.issues?.nodes ?? [];
      setIssues(raw.map((i: Record<string, unknown>) => ({
        ...i,
        status: (i.state as { name: string })?.name ?? 'Unknown',
        statusType: (i.state as { type: string })?.type ?? 'unstarted',
        labels: i.labels ?? { nodes: [] },
      })));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load issues');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleConnect = async () => {
    if (!apiKey.trim()) return;
    setConnecting(true);
    setConnectError('');
    try {
      await linearQuery(apiKey.trim(), `query { viewer { id name } }`);
      setSavedKey(apiKey.trim());
      localStorage.setItem('linear_api_key', apiKey.trim());
      setIsConnected(true);
      await fetchIssues(apiKey.trim());
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setConnecting(false);
    }
  };

  // Auto-connect
  useEffect(() => {
    const stored = localStorage.getItem('linear_api_key');
    if (stored && !isConnected) {
      setConnecting(true);
      linearQuery(stored, `query { viewer { id name } }`)
        .then(() => { setSavedKey(stored); setIsConnected(true); fetchIssues(stored); })
        .catch(() => {})
        .finally(() => setConnecting(false));
    }
  }, [fetchIssues, isConnected]);

  const handleSubmitBug = async () => {
    if (!form.title.trim()) return;
    setSubmitting(true);
    setSubmitError('');
    setSubmitSuccess('');
    try {
      const description = `## Bug Report

**Error Type:** ${form.errorType}
${form.pageUrl ? `**Page/URL:** ${form.pageUrl}` : ''}

### Description
${form.description}

${form.steps ? `### Steps to Reproduce\n${form.steps}` : ''}

---
*Reported via Lexi Admin Bug Board*`;

      const data = await linearQuery(savedKey, `
        mutation CreateIssue($input: IssueCreateInput!) {
          issueCreate(input: $input) {
            success
            issue { id identifier title url }
          }
        }
      `, {
        input: {
          title: `[Bug] ${form.title}`,
          description,
          teamId: LINEAR_TEAM_ID,
          priority: form.priority,
          labelNames: ['Bug'],
        },
      });

      if (data.issueCreate?.success) {
        const issue = data.issueCreate.issue;
        setSubmitSuccess(`Bug report ${issue.identifier} created in Linear!`);
        setForm({ title: '', description: '', priority: 2, errorType: 'UI / Display Bug', pageUrl: '', steps: '' });
        setTimeout(() => { setShowForm(false); setSubmitSuccess(''); fetchIssues(savedKey); }, 2000);
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create bug report');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = issues.filter(issue => {
    if (filterStatus !== 'all' && issue.statusType !== filterStatus) return false;
    if (filterPriority !== 'all' && String(issue.priority) !== filterPriority) return false;
    if (searchQuery && !issue.title.toLowerCase().includes(searchQuery.toLowerCase()) && !issue.identifier.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: issues.length,
    open: issues.filter(i => i.statusType !== 'completed' && i.statusType !== 'cancelled').length,
    urgent: issues.filter(i => i.priority === 1).length,
    inProgress: issues.filter(i => i.statusType === 'started').length,
  };

  // ── Not connected ─────────────────────────────────────────────────────────────
  if (!isConnected && !connecting) {
    return (
      <div className="p-6 max-w-lg mx-auto mt-8">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🐛</span>
          </div>
          <h2 className="text-xl font-serif text-foreground mb-2">Linear Bug Board</h2>
          <p className="text-sm text-muted-foreground">Connect your Linear workspace to track and report bugs directly from the admin panel.</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Linear Personal API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleConnect()}
              placeholder="lin_api_xxxxxxxxxxxxxxxx"
              className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
            />
          </div>
          {connectError && <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">{connectError}</p>}
          <button
            onClick={handleConnect}
            disabled={!apiKey.trim()}
            className="w-full py-3 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-all disabled:opacity-60"
          >
            Connect Linear
          </button>
          <p className="text-xs text-muted-foreground text-center">
            Get your API key at{' '}
            <a href="https://linear.app/settings/api" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              linear.app/settings/api
            </a>
          </p>
        </div>
      </div>
    );
  }

  if (connecting) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Connecting to Linear…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-serif text-foreground">Bug Board</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Track and report errors directly to Linear · Team: Maggimay</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchIssues(savedKey)}
            disabled={loading}
            className="px-3 py-2 border border-border rounded-xl text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all flex items-center gap-1.5"
          >
            <span className={loading ? 'animate-spin' : ''}>↻</span>
            Refresh
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-semibold hover:bg-red-700 transition-all flex items-center gap-1.5"
          >
            <span>🐛</span>
            Report Bug
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Issues', value: stats.total, color: 'text-foreground' },
          { label: 'Open', value: stats.open, color: 'text-blue-600' },
          { label: 'In Progress', value: stats.inProgress, color: 'text-yellow-600' },
          { label: 'Urgent', value: stats.urgent, color: 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-2xl p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">{s.label}</p>
            <p className={`text-2xl font-semibold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search issues…"
          className="flex-1 min-w-[180px] px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
        />
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
        >
          <option value="all">All Status</option>
          <option value="backlog">Backlog</option>
          <option value="unstarted">Todo</option>
          <option value="started">In Progress</option>
          <option value="completed">Done</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          value={filterPriority}
          onChange={e => setFilterPriority(e.target.value)}
          className="px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
        >
          <option value="all">All Priority</option>
          <option value="1">🔴 Urgent</option>
          <option value="2">🟠 High</option>
          <option value="3">🟡 Medium</option>
          <option value="4">🔵 Low</option>
        </select>
      </div>

      {/* Issues List */}
      {loadError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{loadError}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-4xl mb-3">✅</p>
          <p className="text-sm font-medium">No issues found</p>
          <p className="text-xs mt-1">All clear! Or try adjusting your filters.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(issue => {
            const p = PRIORITY_MAP[issue.priority] ?? PRIORITY_MAP[0];
            const statusColor = STATUS_COLORS[issue.statusType] ?? 'bg-gray-400';
            return (
              <div key={issue.id} className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className={`w-2 h-2 rounded-full ${statusColor} mt-1.5 flex-shrink-0`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] text-muted-foreground font-mono">{issue.identifier}</span>
                        <a
                          href={issue.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-foreground hover:text-primary truncate"
                        >
                          {issue.title}
                        </a>
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs text-muted-foreground">{issue.status}</span>
                        {issue.labels?.nodes?.map(label => (
                          <span
                            key={label.id}
                            className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                            style={{ backgroundColor: label.color + '22', color: label.color }}
                          >
                            {label.name}
                          </span>
                        ))}
                        {issue.assignee && (
                          <span className="text-[10px] text-muted-foreground">→ {issue.assignee.name}</span>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(issue.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className={`text-xs font-medium ${p.color} flex items-center gap-1 flex-shrink-0`}>
                    <span>{p.icon}</span>
                    <span className="hidden sm:inline">{p.label}</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bug Report Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-card rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div>
                <h3 className="text-base font-semibold text-foreground">Report a Bug</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Creates an issue in Linear · Team: Maggimay</p>
              </div>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Bug Title *</label>
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Invoice PDF not generating after payment"
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Error Type</label>
                  <select
                    value={form.errorType}
                    onChange={e => setForm(f => ({ ...f, errorType: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {ERROR_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Priority</label>
                  <select
                    value={form.priority}
                    onChange={e => setForm(f => ({ ...f, priority: Number(e.target.value) }))}
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value={1}>🔴 Urgent</option>
                    <option value={2}>🟠 High</option>
                    <option value={3}>🟡 Medium</option>
                    <option value={4}>🔵 Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Page / URL (optional)</label>
                <input
                  value={form.pageUrl}
                  onChange={e => setForm(f => ({ ...f, pageUrl: e.target.value }))}
                  placeholder="e.g. /admin/invoices or /portal/billing"
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  placeholder="Describe what happened and what you expected to happen…"
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Steps to Reproduce (optional)</label>
                <textarea
                  value={form.steps}
                  onChange={e => setForm(f => ({ ...f, steps: e.target.value }))}
                  rows={3}
                  placeholder="1. Go to...\n2. Click on...\n3. See error"
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>

              {submitError && <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">{submitError}</p>}
              {submitSuccess && <p className="text-xs text-green-700 bg-green-50 rounded-xl px-3 py-2">✅ {submitSuccess}</p>}

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 border border-border rounded-xl text-sm font-medium text-muted-foreground hover:bg-secondary/30 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitBug}
                  disabled={submitting || !form.title.trim()}
                  className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Creating…</>
                  ) : (
                    '🐛 Submit Bug Report'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
