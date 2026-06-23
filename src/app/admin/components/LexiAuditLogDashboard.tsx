'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface AuditEntry {
  id: string;
  visitor_id: string | null;
  ip_address: string | null;
  user_message: string;
  assistant_response: string;
  disclaimer_triggered: boolean;
  message_count: number;
  created_at: string;
}

type FilterMode = 'all' | 'disclaimer_only';

function fmtDate(d: string) {
  return new Date(d).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function LexiAuditLogDashboard() {
  const supabase = createClient();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterMode>('disclaimer_only');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [stats, setStats] = useState({ total: 0, disclaimerCount: 0, uniqueVisitors: 0 });

  const PAGE_SIZE = 25;

  const loadEntries = useCallback(
    async (pageNum: number, filterMode: FilterMode) => {
      setLoading(true);
      try {
        let query = supabase
          .from('lexi_audit_log')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

        if (filterMode === 'disclaimer_only') {
          query = query.eq('disclaimer_triggered', true);
        }

        const { data, error, count } = await query;
        if (error) throw error;

        setEntries(data ?? []);
        setHasMore((count ?? 0) > (pageNum + 1) * PAGE_SIZE);
      } catch (err) {
        console.error('Failed to load Lexi audit log:', err);
      } finally {
        setLoading(false);
      }
    },
    [supabase]
  );

  const loadStats = useCallback(async () => {
    try {
      const [totalRes, disclaimerRes, visitorsRes] = await Promise.all([
        supabase.from('lexi_audit_log').select('id', { count: 'exact', head: true }),
        supabase
          .from('lexi_audit_log')
          .select('id', { count: 'exact', head: true })
          .eq('disclaimer_triggered', true),
        supabase.from('lexi_visitor_sessions').select('id', { count: 'exact', head: true }),
      ]);

      setStats({
        total: totalRes.count ?? 0,
        disclaimerCount: disclaimerRes.count ?? 0,
        uniqueVisitors: visitorsRes.count ?? 0,
      });
    } catch {
      // Non-blocking
    }
  }, [supabase]);

  useEffect(() => {
    loadEntries(0, filter);
    loadStats();
  }, [loadEntries, loadStats, filter]);

  const handleFilterChange = (mode: FilterMode) => {
    setFilter(mode);
    setPage(0);
    setExpanded(null);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    loadEntries(newPage, filter);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Lexi Audit Log</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Review all Lexi conversations — flagged entries triggered a legal disclaimer
          </p>
        </div>
        <button
          onClick={() => { loadEntries(page, filter); loadStats(); }}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-600"
        >
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Exchanges</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total.toLocaleString()}</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs text-amber-700 uppercase tracking-wide mb-1">Disclaimer Triggered</p>
          <p className="text-2xl font-bold text-amber-800">{stats.disclaimerCount.toLocaleString()}</p>
          {stats.total > 0 && (
            <p className="text-xs text-amber-600 mt-0.5">
              {Math.round((stats.disclaimerCount / stats.total) * 100)}% of conversations
            </p>
          )}
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-xs text-blue-700 uppercase tracking-wide mb-1">Unique Visitors</p>
          <p className="text-2xl font-bold text-blue-800">{stats.uniqueVisitors.toLocaleString()}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(['disclaimer_only', 'all'] as FilterMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => handleFilterChange(mode)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === mode
                ? 'bg-[#1B2A4A] text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {mode === 'disclaimer_only' ? '⚖️ Disclaimer Flagged' : 'All Exchanges'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-[#1B2A4A] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-4xl mb-3">📋</p>
            <p className="font-medium">No entries found</p>
            <p className="text-sm mt-1">
              {filter === 'disclaimer_only' ?'No disclaimer-triggered responses yet' :'No Lexi conversations logged yet'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {entries.map((entry) => (
              <div key={entry.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      {entry.disclaimer_triggered && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
                          ⚖️ Disclaimer
                        </span>
                      )}
                      <span className="text-xs text-gray-400">{fmtDate(entry.created_at)}</span>
                      {entry.visitor_id && (
                        <span className="text-xs text-gray-400 font-mono truncate max-w-[120px]">
                          {entry.visitor_id.slice(0, 16)}…
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {entry.message_count} msg{entry.message_count !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* User message */}
                    <div className="mb-2">
                      <p className="text-xs font-medium text-gray-500 mb-0.5">Visitor asked:</p>
                      <p className="text-sm text-gray-800 leading-relaxed line-clamp-2">
                        {entry.user_message}
                      </p>
                    </div>

                    {/* Assistant response — expandable */}
                    {expanded === entry.id ? (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-0.5">Lexi responded:</p>
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                          {entry.assistant_response}
                        </p>
                        <button
                          onClick={() => setExpanded(null)}
                          className="text-xs text-[#1B2A4A] hover:underline mt-1"
                        >
                          Show less
                        </button>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-0.5">Lexi responded:</p>
                        <p className="text-sm text-gray-700 leading-relaxed line-clamp-2">
                          {entry.assistant_response}
                        </p>
                        {entry.assistant_response.length > 120 && (
                          <button
                            onClick={() => setExpanded(entry.id)}
                            className="text-xs text-[#1B2A4A] hover:underline mt-1"
                          >
                            Show full response
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && entries.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-500">
              Page {page + 1} · {entries.length} entries shown
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 0}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-white transition-colors"
              >
                ← Previous
              </button>
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={!hasMore}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-white transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
