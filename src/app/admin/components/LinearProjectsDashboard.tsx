'use client';

import React, { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LinearUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

interface LinearLabel {
  id: string;
  name: string;
  color: string;
}

interface LinearStatus {
  id: string;
  name: string;
  type: string;
  color?: string;
}

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
  dueDate?: string;
  assignee?: { id: string; name: string; avatarUrl?: string };
  labels: { nodes: LinearLabel[] };
  team: { id: string; name: string };
}

interface LinearProject {
  id: string;
  name: string;
  description?: string;
  state: string;
  progress: number;
  startDate?: string;
  targetDate?: string;
  url: string;
  lead?: { id: string; name: string };
  members?: { nodes: LinearUser[] };
  issues?: { nodes: LinearIssue[] };
}

interface LinearTeam {
  id: string;
  name: string;
  key: string;
  issueCount?: number;
}

interface CreateIssueForm {
  title: string;
  description: string;
  priority: number;
  teamId: string;
  assigneeId: string;
  dueDate: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

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
  duplicate: 'bg-purple-400',
};

const LINEAR_GRAPHQL_ENDPOINT = 'https://api.linear.app/graphql';

// ─── API Helper ───────────────────────────────────────────────────────────────

async function linearQuery(apiKey: string, query: string, variables?: Record<string, unknown>) {
  const res = await fetch(LINEAR_GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: apiKey,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Linear API error: ${res.status} ${res.statusText}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0]?.message ?? 'GraphQL error');
  return json.data;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: number }) {
  const p = PRIORITY_MAP[priority] ?? PRIORITY_MAP[0];
  return (
    <span className={`text-xs font-medium ${p.color} flex items-center gap-1`}>
      <span>{p.icon}</span>
      <span className="hidden sm:inline">{p.label}</span>
    </span>
  );
}

function StatusDot({ statusType, statusName }: { statusType: string; statusName: string }) {
  const colorClass = STATUS_COLORS[statusType] ?? 'bg-gray-400';
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${colorClass} flex-shrink-0`} />
      <span className="text-xs text-muted-foreground truncate max-w-[80px]">{statusName}</span>
    </span>
  );
}

function IssueCard({ issue, onStatusChange }: { issue: LinearIssue; onStatusChange?: (id: string, status: string) => void }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-all group">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-muted-foreground font-mono flex-shrink-0">{issue.identifier}</span>
          <a
            href={issue.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-foreground hover:text-primary truncate"
          >
            {issue.title}
          </a>
        </div>
        <PriorityBadge priority={issue.priority} />
      </div>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <StatusDot statusType={issue.statusType} statusName={issue.status} />
        <div className="flex items-center gap-2">
          {issue.labels?.nodes?.map((label) => (
            <span
              key={label.id}
              className="px-1.5 py-0.5 rounded text-[10px] font-medium"
              style={{ backgroundColor: label.color + '22', color: label.color }}
            >
              {label.name}
            </span>
          ))}
          {issue.assignee && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                {issue.assignee.name.charAt(0).toUpperCase()}
              </span>
              <span className="hidden sm:inline">{issue.assignee.name}</span>
            </span>
          )}
          {issue.dueDate && (
            <span className="text-[10px] text-muted-foreground">
              Due {new Date(issue.dueDate).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function KanbanColumn({ title, statusType, issues }: { title: string; statusType: string; issues: LinearIssue[] }) {
  const colorClass = STATUS_COLORS[statusType] ?? 'bg-gray-400';
  return (
    <div className="flex-1 min-w-[240px] max-w-[320px]">
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-2.5 h-2.5 rounded-full ${colorClass}`} />
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</span>
        <span className="ml-auto text-xs bg-secondary text-muted-foreground rounded-full px-2 py-0.5">{issues.length}</span>
      </div>
      <div className="space-y-2">
        {issues.length === 0 ? (
          <div className="border border-dashed border-border rounded-xl p-4 text-center text-xs text-muted-foreground">
            No issues
          </div>
        ) : (
          issues.map((issue) => <IssueCard key={issue.id} issue={issue} />)
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LinearProjectsDashboard() {
  const [apiKey, setApiKey] = useState('');
  const [savedApiKey, setSavedApiKey] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState('');

  const [teams, setTeams] = useState<LinearTeam[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<LinearTeam | null>(null);
  const [issues, setIssues] = useState<LinearIssue[]>([]);
  const [projects, setProjects] = useState<LinearProject[]>([]);
  const [statuses, setStatuses] = useState<LinearStatus[]>([]);
  const [users, setUsers] = useState<LinearUser[]>([]);

  const [loadingIssues, setLoadingIssues] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [issueError, setIssueError] = useState('');

  const [view, setView] = useState<'board' | 'list' | 'projects'>('board');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<CreateIssueForm>({
    title: '',
    description: '',
    priority: 0,
    teamId: '',
    assigneeId: '',
    dueDate: '',
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');

  // Load saved key from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('linear_api_key');
    if (stored) {
      setSavedApiKey(stored);
      setApiKey(stored);
    }
  }, []);

  const fetchTeamsAndData = useCallback(async (key: string) => {
    setConnecting(true);
    setConnectError('');
    try {
      const data = await linearQuery(key, `
        query {
          teams { nodes { id name key } }
          viewer { id name email }
        }
      `);
      const fetchedTeams: LinearTeam[] = data.teams?.nodes ?? [];
      setTeams(fetchedTeams);
      setIsConnected(true);
      setSavedApiKey(key);
      localStorage.setItem('linear_api_key', key);
      if (fetchedTeams.length > 0) {
        setSelectedTeam(fetchedTeams[0]);
        setCreateForm((f) => ({ ...f, teamId: fetchedTeams[0].id }));
      }
    } catch (err: unknown) {
      setConnectError(err instanceof Error ? err.message : 'Failed to connect to Linear');
      setIsConnected(false);
    } finally {
      setConnecting(false);
    }
  }, []);

  // Auto-connect if key stored
  useEffect(() => {
    const stored = localStorage.getItem('linear_api_key');
    if (stored && !isConnected) {
      fetchTeamsAndData(stored);
    }
  }, [fetchTeamsAndData, isConnected]);

  const fetchIssues = useCallback(async () => {
    if (!savedApiKey || !selectedTeam) return;
    setLoadingIssues(true);
    setIssueError('');
    try {
      const data = await linearQuery(savedApiKey, `
        query TeamIssues($teamId: String!) {
          team(id: $teamId) {
            issues(first: 50, orderBy: updatedAt) {
              nodes {
                id
                identifier
                title
                description
                priority
                priorityLabel
                url
                createdAt
                updatedAt
                dueDate
                state { id name type color }
                assignee { id name avatarUrl }
                labels { nodes { id name color } }
                team { id name }
              }
            }
            states { nodes { id name type color } }
            members { nodes { id name email avatarUrl } }
          }
        }
      `, { teamId: selectedTeam.id });

      const teamData = data.team;
      const rawIssues = teamData?.issues?.nodes ?? [];
      const mappedIssues: LinearIssue[] = rawIssues.map((i: Record<string, unknown>) => ({
        ...i,
        status: (i.state as { name: string })?.name ?? 'Unknown',
        statusType: (i.state as { type: string })?.type ?? 'unstarted',
        labels: i.labels ?? { nodes: [] },
      }));
      setIssues(mappedIssues);
      setStatuses(teamData?.states?.nodes ?? []);
      setUsers(teamData?.members?.nodes ?? []);
    } catch (err: unknown) {
      setIssueError(err instanceof Error ? err.message : 'Failed to load issues');
    } finally {
      setLoadingIssues(false);
    }
  }, [savedApiKey, selectedTeam]);

  const fetchProjects = useCallback(async () => {
    if (!savedApiKey || !selectedTeam) return;
    setLoadingProjects(true);
    try {
      const data = await linearQuery(savedApiKey, `
        query TeamProjects($teamId: String!) {
          team(id: $teamId) {
            projects(first: 20) {
              nodes {
                id
                name
                description
                state
                progress
                startDate
                targetDate
                url
                lead { id name }
                members { nodes { id name } }
              }
            }
          }
        }
      `, { teamId: selectedTeam.id });
      setProjects(data.team?.projects?.nodes ?? []);
    } catch {
      // silently fail projects
    } finally {
      setLoadingProjects(false);
    }
  }, [savedApiKey, selectedTeam]);

  useEffect(() => {
    if (isConnected && selectedTeam) {
      fetchIssues();
      fetchProjects();
    }
  }, [isConnected, selectedTeam, fetchIssues, fetchProjects]);

  const handleConnect = async () => {
    if (!apiKey.trim()) return;
    await fetchTeamsAndData(apiKey.trim());
  };

  const handleDisconnect = () => {
    localStorage.removeItem('linear_api_key');
    setSavedApiKey('');
    setApiKey('');
    setIsConnected(false);
    setTeams([]);
    setIssues([]);
    setProjects([]);
    setSelectedTeam(null);
  };

  const handleCreateIssue = async () => {
    if (!createForm.title.trim() || !createForm.teamId) return;
    setCreating(true);
    setCreateError('');
    setCreateSuccess('');
    try {
      const mutation = `
        mutation CreateIssue($input: IssueCreateInput!) {
          issueCreate(input: $input) {
            success
            issue { id identifier title url }
          }
        }
      `;
      const input: Record<string, unknown> = {
        title: createForm.title,
        teamId: createForm.teamId,
        priority: createForm.priority,
      };
      if (createForm.description) input.description = createForm.description;
      if (createForm.assigneeId) input.assigneeId = createForm.assigneeId;
      if (createForm.dueDate) input.dueDate = createForm.dueDate;

      const data = await linearQuery(savedApiKey, mutation, { input });
      if (data.issueCreate?.success) {
        setCreateSuccess(`Issue ${data.issueCreate.issue.identifier} created successfully!`);
        setCreateForm({ title: '', description: '', priority: 0, teamId: selectedTeam?.id ?? '', assigneeId: '', dueDate: '' });
        setTimeout(() => {
          setShowCreateModal(false);
          setCreateSuccess('');
          fetchIssues();
        }, 1500);
      }
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create issue');
    } finally {
      setCreating(false);
    }
  };

  // ── Filtered issues ──────────────────────────────────────────────────────────
  const filteredIssues = issues.filter((issue) => {
    if (filterStatus !== 'all' && issue.statusType !== filterStatus) return false;
    if (filterPriority !== 'all' && String(issue.priority) !== filterPriority) return false;
    if (searchQuery && !issue.title.toLowerCase().includes(searchQuery.toLowerCase()) && !issue.identifier.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const kanbanColumns = [
    { title: 'Backlog', statusType: 'backlog' },
    { title: 'Todo', statusType: 'unstarted' },
    { title: 'In Progress', statusType: 'started' },
    { title: 'Done', statusType: 'completed' },
    { title: 'Cancelled', statusType: 'cancelled' },
  ];

  // ── Stats ────────────────────────────────────────────────────────────────────
  const stats = {
    total: issues.length,
    inProgress: issues.filter((i) => i.statusType === 'started').length,
    done: issues.filter((i) => i.statusType === 'completed').length,
    urgent: issues.filter((i) => i.priority === 1).length,
  };

  // ── Not connected UI ─────────────────────────────────────────────────────────
  if (!isConnected) {
    return (
      <div className="p-6 max-w-lg mx-auto mt-12">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
          </div>
          <h2 className="text-xl font-serif text-foreground mb-2">Connect Linear</h2>
          <p className="text-sm text-muted-foreground">
            Enter your Linear personal API key to connect issue tracking, project boards, and task workflows.
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              Personal API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
              placeholder="lin_api_xxxxxxxxxxxxxxxx"
              className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
            />
          </div>

          {connectError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
              {connectError}
            </div>
          )}

          <button
            onClick={handleConnect}
            disabled={connecting || !apiKey.trim()}
            className="w-full py-3 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {connecting ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Connecting…
              </>
            ) : 'Connect to Linear'}
          </button>

          <p className="text-xs text-muted-foreground text-center">
            Get your API key from{' '}
            <a href="https://linear.app/settings/api" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Linear Settings → API
            </a>
          </p>
        </div>
      </div>
    );
  }

  // ── Connected UI ─────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-serif text-foreground">Linear</h2>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="text-xs text-muted-foreground">Connected</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Team selector */}
          {teams.length > 1 && (
            <select
              value={selectedTeam?.id ?? ''}
              onChange={(e) => {
                const t = teams.find((t) => t.id === e.target.value);
                if (t) { setSelectedTeam(t); setCreateForm((f) => ({ ...f, teamId: t.id })); }
              }}
              className="px-3 py-2 bg-card border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary/90 transition-all"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Issue
          </button>
          <button
            onClick={() => { fetchIssues(); fetchProjects(); }}
            disabled={loadingIssues}
            className="p-2 bg-card border border-border rounded-xl text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all disabled:opacity-60"
            title="Refresh"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={loadingIssues ? 'animate-spin' : ''}>
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
          </button>
          <button
            onClick={handleDisconnect}
            className="px-3 py-2 bg-card border border-border rounded-xl text-xs text-muted-foreground hover:text-red-500 hover:border-red-200 transition-all"
          >
            Disconnect
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Issues', value: stats.total, color: 'text-foreground', bg: 'bg-card' },
          { label: 'In Progress', value: stats.inProgress, color: 'text-blue-500', bg: 'bg-blue-50' },
          { label: 'Completed', value: stats.done, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Urgent', value: stats.urgent, color: 'text-red-500', bg: 'bg-red-50' },
        ].map((stat) => (
          <div key={stat.label} className={`${stat.bg} border border-border rounded-2xl p-4`}>
            <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* View toggle + filters */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1 bg-secondary/40 rounded-xl p-1">
          {(['board', 'list', 'projects'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                view === v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {v === 'board' ? '⬛ Board' : v === 'list' ? '☰ List' : '📁 Projects'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            placeholder="Search issues…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-2 bg-card border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 w-40"
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-card border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="all">All Statuses</option>
            <option value="backlog">Backlog</option>
            <option value="unstarted">Todo</option>
            <option value="started">In Progress</option>
            <option value="completed">Done</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-3 py-2 bg-card border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="all">All Priorities</option>
            <option value="1">🔴 Urgent</option>
            <option value="2">🟠 High</option>
            <option value="3">🟡 Medium</option>
            <option value="4">🔵 Low</option>
            <option value="0">— No Priority</option>
          </select>
        </div>
      </div>

      {/* Error */}
      {issueError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {issueError}
        </div>
      )}

      {/* Loading */}
      {loadingIssues && (
        <div className="flex items-center justify-center py-12">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin text-primary mr-3">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          <span className="text-sm text-muted-foreground">Loading issues…</span>
        </div>
      )}

      {/* Board View */}
      {!loadingIssues && view === 'board' && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {kanbanColumns.map((col) => (
            <KanbanColumn
              key={col.statusType}
              title={col.title}
              statusType={col.statusType}
              issues={filteredIssues.filter((i) => i.statusType === col.statusType)}
            />
          ))}
        </div>
      )}

      {/* List View */}
      {!loadingIssues && view === 'list' && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {filteredIssues.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No issues found</div>
          ) : (
            <div className="divide-y divide-border">
              {filteredIssues.map((issue) => (
                <div key={issue.id} className="flex items-center gap-4 px-5 py-3 hover:bg-secondary/20 transition-all">
                  <span className="text-xs text-muted-foreground font-mono w-16 flex-shrink-0">{issue.identifier}</span>
                  <StatusDot statusType={issue.statusType} statusName={issue.status} />
                  <a
                    href={issue.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-sm text-foreground hover:text-primary truncate"
                  >
                    {issue.title}
                  </a>
                  <PriorityBadge priority={issue.priority} />
                  {issue.assignee && (
                    <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0" title={issue.assignee.name}>
                      {issue.assignee.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  {issue.dueDate && (
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">
                      {new Date(issue.dueDate).toLocaleDateString()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Projects View */}
      {!loadingIssues && view === 'projects' && (
        <div>
          {loadingProjects ? (
            <div className="flex items-center justify-center py-12">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin text-primary mr-3">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              <span className="text-sm text-muted-foreground">Loading projects…</span>
            </div>
          ) : projects.length === 0 ? (
            <div className="bg-card border border-dashed border-border rounded-2xl p-12 text-center">
              <p className="text-sm text-muted-foreground mb-2">No projects found for this team</p>
              <a
                href="https://linear.app"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline"
              >
                Create a project in Linear →
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project) => (
                <a
                  key={project.id}
                  href={project.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-card border border-border rounded-2xl p-5 hover:border-primary/30 transition-all block"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-sm font-semibold text-foreground">{project.name}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      project.state === 'completed' ? 'bg-green-100 text-green-700' :
                      project.state === 'started' ? 'bg-blue-100 text-blue-700' :
                      project.state === 'paused'? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {project.state}
                    </span>
                  </div>
                  {project.description && (
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{project.description}</p>
                  )}
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>Progress</span>
                      <span>{Math.round(project.progress * 100)}%</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-1.5">
                      <div
                        className="bg-primary h-1.5 rounded-full transition-all"
                        style={{ width: `${Math.round(project.progress * 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    {project.lead && <span>Lead: {project.lead.name}</span>}
                    {project.targetDate && <span>Due {new Date(project.targetDate).toLocaleDateString()}</span>}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Issue Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-serif text-foreground">Create Issue</h3>
              <button
                onClick={() => { setShowCreateModal(false); setCreateError(''); setCreateSuccess(''); }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Title *</label>
                <input
                  type="text"
                  value={createForm.title}
                  onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Issue title"
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Description</label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Optional description…"
                  rows={3}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Priority</label>
                  <select
                    value={createForm.priority}
                    onChange={(e) => setCreateForm((f) => ({ ...f, priority: Number(e.target.value) }))}
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value={0}>No priority</option>
                    <option value={1}>🔴 Urgent</option>
                    <option value={2}>🟠 High</option>
                    <option value={3}>🟡 Medium</option>
                    <option value={4}>🔵 Low</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Assignee</label>
                  <select
                    value={createForm.assigneeId}
                    onChange={(e) => setCreateForm((f) => ({ ...f, assigneeId: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">Unassigned</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Due Date</label>
                <input
                  type="date"
                  value={createForm.dueDate}
                  onChange={(e) => setCreateForm((f) => ({ ...f, dueDate: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {createError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">{createError}</div>
              )}
              {createSuccess && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-700">{createSuccess}</div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => { setShowCreateModal(false); setCreateError(''); setCreateSuccess(''); }}
                  className="flex-1 py-2.5 bg-secondary text-foreground rounded-xl text-sm font-medium hover:bg-secondary/80 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateIssue}
                  disabled={creating || !createForm.title.trim()}
                  className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {creating ? (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                      </svg>
                      Creating…
                    </>
                  ) : 'Create Issue'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
