'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface SyncResult {
  synced: number;
  error?: string;
}

interface SyncLog {
  id: string;
  sync_type: string;
  status: string;
  records_synced: number;
  error_message?: string;
  started_at: string;
  completed_at?: string;
}

interface ClioStatus {
  connected: boolean;
  expired?: boolean;
  clio_user_name?: string;
  clio_user_id?: number;
  clio_account_id?: number;
  token_created_at?: string;
}

interface SyncStats {
  counts: { matters: number; contacts: number; time_entries: number };
  recent_syncs: SyncLog[];
}

const SYNC_TYPES = [
  { key: 'matters', label: 'Matters', icon: '⚖️', description: 'Active & closed legal matters' },
  { key: 'contacts', label: 'Contacts', icon: '👥', description: 'Clients & related contacts' },
  { key: 'time_entries', label: 'Time Entries', icon: '⏱️', description: 'Billable & non-billable hours' },
];

export default function ClioIntegrationDashboard() {
  const [status, setStatus] = useState<ClioStatus | null>(null);
  const [stats, setStats] = useState<SyncStats | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResults, setSyncResults] = useState<Record<string, SyncResult> | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['matters', 'contacts', 'time_entries']);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'logs'>('overview');

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/clio/status');
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus({ connected: false });
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/clio/sync');
      const data = await res.json();
      setStats(data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchStatus(), fetchStats()]);
      setLoading(false);
    };
    init();

    // Check URL params for OAuth result
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('clio_connected') === 'true') {
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [fetchStatus, fetchStats]);

  const handleConnect = () => {
    window.location.href = '/api/clio/auth';
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect Clio? Synced data will remain but the OAuth token will be removed.')) return;
    setDisconnecting(true);
    try {
      await fetch('/api/clio/status', { method: 'DELETE' });
      setStatus({ connected: false });
      setSyncResults(null);
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSync = async () => {
    if (selectedTypes.length === 0) return;
    setSyncing(true);
    setSyncResults(null);
    try {
      const res = await fetch('/api/clio/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ types: selectedTypes }),
      });
      const data = await res.json();
      setSyncResults(data.results);
      await fetchStats();
    } catch (err) {
      setSyncResults({ error: { synced: 0, error: 'Network error. Please try again.' } });
    } finally {
      setSyncing(false);
    }
  };

  const toggleType = (key: string) => {
    setSelectedTypes(prev =>
      prev.includes(key) ? prev.filter(t => t !== key) : [...prev, key]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-[#1B2A4A] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1B2A4A] flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M2 17l10 5 10-5" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M2 12l10 5 10-5" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#1B2A4A]">Clio Integration</h2>
            <p className="text-sm text-gray-500">Sync matters, contacts & time entries</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {status?.connected ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 text-green-700 text-xs font-medium border border-green-200">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 text-gray-500 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
              Not Connected
            </span>
          )}
        </div>
      </div>

      {/* Not connected state */}
      {!status?.connected && (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#1B2A4A]/10 flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="#1B2A4A" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M2 17l10 5 10-5" stroke="#1B2A4A" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M2 12l10 5 10-5" stroke="#1B2A4A" strokeWidth="1.5" strokeLinejoin="round"/>
            </svg>
          </div>
          <h3 className="text-base font-semibold text-[#1B2A4A] mb-1">Connect Your Clio Account</h3>
          <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
            Authorize Broussard Legal Services to sync your Clio matters, contacts, and time entries.
          </p>
          <button
            onClick={handleConnect}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#1B2A4A] text-white text-sm font-medium rounded-xl hover:bg-[#1B2A4A]/90 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Connect with Clio
          </button>
          <p className="text-xs text-gray-400 mt-3">
            You&apos;ll be redirected to Clio to authorize access. Requires CLIO_CLIENT_ID and CLIO_CLIENT_SECRET in your environment.
          </p>
        </div>
      )}

      {/* Connected state */}
      {status?.connected && (
        <>
          {/* Account info */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#1B2A4A]">
                {status.clio_user_name ?? 'Clio Account'}
              </p>
              {status.clio_user_id && (
                <p className="text-xs text-gray-400 mt-0.5">User ID: {status.clio_user_id}</p>
              )}
              {status.token_created_at && (
                <p className="text-xs text-gray-400">
                  Connected {new Date(status.token_created_at).toLocaleDateString()}
                </p>
              )}
            </div>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors disabled:opacity-50"
            >
              {disconnecting ? 'Disconnecting…' : 'Disconnect'}
            </button>
          </div>

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-3 gap-3">
              {SYNC_TYPES.map(t => (
                <div key={t.key} className="rounded-xl border border-gray-200 bg-white p-4 text-center">
                  <div className="text-2xl mb-1">{t.icon}</div>
                  <div className="text-2xl font-bold text-[#1B2A4A]">
                    {stats.counts[t.key as keyof typeof stats.counts] ?? 0}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{t.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 border-b border-gray-200">
            {(['overview', 'logs'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                  activeTab === tab
                    ? 'border-[#1B2A4A] text-[#1B2A4A]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'logs' ? 'Sync History' : 'Sync Data'}
              </button>
            ))}
          </div>

          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Select sync types */}
              <div>
                <p className="text-sm font-medium text-[#1B2A4A] mb-3">Select data to sync:</p>
                <div className="grid grid-cols-1 gap-2">
                  {SYNC_TYPES.map(t => (
                    <label
                      key={t.key}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                        selectedTypes.includes(t.key)
                          ? 'border-[#1B2A4A] bg-[#1B2A4A]/5'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedTypes.includes(t.key)}
                        onChange={() => toggleType(t.key)}
                        className="w-4 h-4 accent-[#1B2A4A]"
                      />
                      <span className="text-xl">{t.icon}</span>
                      <div>
                        <p className="text-sm font-medium text-[#1B2A4A]">{t.label}</p>
                        <p className="text-xs text-gray-500">{t.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <button
                onClick={handleSync}
                disabled={syncing || selectedTypes.length === 0}
                className="w-full py-3 bg-[#1B2A4A] text-white text-sm font-medium rounded-xl hover:bg-[#1B2A4A]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {syncing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Syncing…
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M23 4v6h-6M1 20v-6h6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Sync Now
                  </>
                )}
              </button>

              {/* Sync results */}
              {syncResults && (
                <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
                  <p className="text-sm font-medium text-[#1B2A4A] mb-3">Sync Results</p>
                  {Object.entries(syncResults).map(([type, result]) => (
                    <div key={type} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                      <span className="text-sm text-gray-700 capitalize">{type.replace('_', ' ')}</span>
                      {result.error ? (
                        <span className="text-xs text-red-500 max-w-[200px] text-right">{result.error}</span>
                      ) : (
                        <span className="text-sm font-medium text-green-600">
                          ✓ {result.synced} records
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="space-y-2">
              {!stats?.recent_syncs?.length ? (
                <p className="text-sm text-gray-500 text-center py-8">No sync history yet.</p>
              ) : (
                stats.recent_syncs.map(log => (
                  <div key={log.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-200 bg-white">
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          log.status === 'completed'
                            ? 'bg-green-500'
                            : log.status === 'failed' ?'bg-red-500' :'bg-yellow-500'
                        }`}
                      />
                      <div>
                        <p className="text-sm font-medium text-[#1B2A4A] capitalize">
                          {log.sync_type.replace('_', ' ')}
                        </p>
                        {log.error_message && (
                          <p className="text-xs text-red-500 mt-0.5">{log.error_message}</p>
                        )}
                        <p className="text-xs text-gray-400">
                          {new Date(log.started_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-[#1B2A4A]">{log.records_synced}</p>
                      <p className="text-xs text-gray-400">records</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
