'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SyncStatus {
  connected: boolean;
  lastSync: string | null;
  error: string | null;
  mattersCount: number;
  contactsCount: number;
  timeEntriesCount: number;
}

interface SyncLog {
  id: string;
  sync_type: string;
  status: string;
  records_synced: number | null;
  error_message: string | null;
  created_at: string;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ClioSyncHealthPanel() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncResults, setSyncResults] = useState<Record<string, { synced: number; error?: string }>>({});
  const [lastSyncTimes, setLastSyncTimes] = useState<Record<string, string>>({});

  const fetchStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const res = await fetch('/api/clio/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      } else {
        setStatus({ connected: false, lastSync: null, error: 'Clio not connected', mattersCount: 0, contactsCount: 0, timeEntriesCount: 0 });
      }
    } catch {
      setStatus({ connected: false, lastSync: null, error: 'Failed to reach Clio API', mattersCount: 0, contactsCount: 0, timeEntriesCount: 0 });
    } finally {
      setStatusLoading(false);
    }
  }, []);

  const fetchSyncLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const supabase = createClient();
      // Try to get sync data from clio_matters table
      const [mattersRes, contactsRes, timeRes] = await Promise.all([
        supabase.from('clio_matters').select('synced_at').order('synced_at', { ascending: false }).limit(1),
        supabase.from('clio_contacts').select('synced_at').order('synced_at', { ascending: false }).limit(1),
        supabase.from('clio_time_entries').select('synced_at').order('synced_at', { ascending: false }).limit(1),
      ]);

      const times: Record<string, string> = {};
      if (mattersRes.data?.[0]?.synced_at) times.matters = mattersRes.data[0].synced_at;
      if (contactsRes.data?.[0]?.synced_at) times.contacts = contactsRes.data[0].synced_at;
      if (timeRes.data?.[0]?.synced_at) times.time_entries = timeRes.data[0].synced_at;
      setLastSyncTimes(times);
    } catch {
      // silently fail
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchSyncLogs();
  }, [fetchStatus, fetchSyncLogs]);

  const handleSync = async (type: string) => {
    setSyncing(type);
    setSyncResults(prev => ({ ...prev, [type]: { synced: 0 } }));
    try {
      const res = await fetch('/api/clio/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (res.ok) {
        setSyncResults(prev => ({ ...prev, [type]: { synced: data.synced ?? 0 } }));
        await fetchSyncLogs();
        await fetchStatus();
      } else {
        setSyncResults(prev => ({ ...prev, [type]: { synced: 0, error: data.error ?? 'Sync failed' } }));
      }
    } catch (err) {
      setSyncResults(prev => ({ ...prev, [type]: { synced: 0, error: 'Network error' } }));
    } finally {
      setSyncing(null);
    }
  };

  const handleFullResync = async () => {
    for (const type of ['matters', 'contacts', 'time_entries']) {
      await handleSync(type);
    }
  };

  const formatTime = (t: string | null | undefined) => {
    if (!t) return 'Never';
    const d = new Date(t);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const SYNC_TYPES = [
    { key: 'matters', label: 'Matters', icon: '⚖️', description: 'Client matters and cases' },
    { key: 'contacts', label: 'Contacts', icon: '👥', description: 'Clients and contacts' },
    { key: 'time_entries', label: 'Time Entries', icon: '⏱️', description: 'Billable time records' },
  ];

  const isConnected = status?.connected ?? false;
  const hasClioCredentials = !!(process.env.NEXT_PUBLIC_SITE_URL); // Always show panel

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-serif text-foreground">Clio Sync Health</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Monitor sync status, error counts, and trigger manual resyncs</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { fetchStatus(); fetchSyncLogs(); }}
            disabled={statusLoading}
            className="px-3 py-2 border border-border rounded-xl text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all flex items-center gap-1.5"
          >
            <span className={statusLoading ? 'animate-spin' : ''}>↻</span>
            Refresh
          </button>
          <button
            onClick={handleFullResync}
            disabled={!!syncing}
            className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary/90 transition-all disabled:opacity-60 flex items-center gap-1.5"
          >
            {syncing ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Syncing…</> : '🔄 Full Resync'}
          </button>
        </div>
      </div>

      {/* Connection Status Banner */}
      <div className={`rounded-2xl border p-4 flex items-center gap-4 ${isConnected ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isConnected ? 'bg-green-100' : 'bg-amber-100'}`}>
          <span className="text-xl">{isConnected ? '✅' : '⚠️'}</span>
        </div>
        <div className="flex-1">
          <p className={`text-sm font-semibold ${isConnected ? 'text-green-800' : 'text-amber-800'}`}>
            {isConnected ? 'Clio Connected' : 'Clio Not Connected'}
          </p>
          <p className={`text-xs mt-0.5 ${isConnected ? 'text-green-600' : 'text-amber-600'}`}>
            {isConnected
              ? `Last sync: ${formatTime(status?.lastSync)}`
              : status?.error ?? 'Configure CLIO_CLIENT_ID and CLIO_CLIENT_SECRET to connect'}
          </p>
        </div>
        {!isConnected && (
          <a
            href="/api/clio/auth"
            className="px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-semibold hover:bg-amber-700 transition-all"
          >
            Connect Clio
          </a>
        )}
      </div>

      {/* Sync Type Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {SYNC_TYPES.map(type => {
          const result = syncResults[type.key];
          const lastSync = lastSyncTimes[type.key];
          const isSyncing = syncing === type.key;

          return (
            <div key={type.key} className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{type.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{type.label}</p>
                    <p className="text-xs text-muted-foreground">{type.description}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Last Sync</span>
                  <span className="text-xs font-medium text-foreground">{formatTime(lastSync)}</span>
                </div>
                {result && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Last Result</span>
                    {result.error ? (
                      <span className="text-xs text-red-600">Error: {result.error}</span>
                    ) : (
                      <span className="text-xs text-green-600">✓ {result.synced} synced</span>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={() => handleSync(type.key)}
                disabled={!!syncing}
                className="w-full py-2 border border-border rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isSyncing ? (
                  <><div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" /> Syncing…</>
                ) : (
                  <>↻ Sync {type.label}</>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Sync Stats */}
      {status && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="font-serif text-base text-foreground mb-4">Synced Records</h3>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Matters', value: status.mattersCount, icon: '⚖️' },
              { label: 'Contacts', value: status.contactsCount, icon: '👥' },
              { label: 'Time Entries', value: status.timeEntriesCount, icon: '⏱️' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className="text-2xl mb-1">{s.icon}</p>
                <p className="text-2xl font-semibold text-foreground">{s.value.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Setup Instructions (if not connected) */}
      {!isConnected && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="font-serif text-base text-foreground mb-3">Setup Instructions</h3>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
              <p>Add <code className="bg-secondary/50 px-1 rounded text-xs">CLIO_CLIENT_ID</code> and <code className="bg-secondary/50 px-1 rounded text-xs">CLIO_CLIENT_SECRET</code> to your environment variables</p>
            </div>
            <div className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
              <p>Click "Connect Clio" above to authorize via OAuth</p>
            </div>
            <div className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
              <p>Use "Full Resync" to pull all matters, contacts, and time entries from Clio</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
