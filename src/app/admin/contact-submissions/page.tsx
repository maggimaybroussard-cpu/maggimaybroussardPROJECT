'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  firm: string | null;
  service: string;
  message: string;
  status: string;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-50 text-blue-700 border border-blue-200',
  in_review: 'bg-amber-50 text-amber-700 border border-amber-200',
  contacted: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  closed: 'bg-gray-100 text-gray-500 border border-gray-200',
};

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  in_review: 'In Review',
  contacted: 'Contacted',
  closed: 'Closed',
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function truncate(text: string, maxLen = 80) {
  if (!text) return '—';
  return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
}

export default function ContactSubmissionsPage() {
  const supabase = createClient();
  const [submissions, setSubmissions] = useState<ContactSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('contact_inquiries')
        .select('id, name, email, firm, service, message, status, created_at')
        .order('created_at', { ascending: false });
      if (fetchError) throw fetchError;
      setSubmissions(data ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load submissions');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  const filtered = submissions.filter((s) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      s.name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      s.service.toLowerCase().includes(q) ||
      (s.firm ?? '').toLowerCase().includes(q) ||
      s.message.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const counts = {
    total: submissions.length,
    new: submissions.filter((s) => s.status === 'new').length,
    inReview: submissions.filter((s) => s.status === 'in_review').length,
    contacted: submissions.filter((s) => s.status === 'contacted').length,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="text-muted-foreground hover:text-foreground transition-colors text-sm flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Admin
            </Link>
            <span className="text-muted-foreground">/</span>
            <h1 className="text-lg font-semibold text-foreground">Contact Submissions</h1>
          </div>
          <button
            onClick={fetchSubmissions}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total', value: counts.total, color: 'text-foreground' },
            { label: 'New', value: counts.new, color: 'text-blue-600' },
            { label: 'In Review', value: counts.inReview, color: 'text-amber-600' },
            { label: 'Contacted', value: counts.contacted, color: 'text-emerald-600' },
          ].map((stat) => (
            <div key={stat.label} className="bg-card border border-border rounded-xl p-4">
              <p className={`text-2xl font-semibold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by name, email, service…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm bg-card border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
          >
            <option value="all">All Statuses</option>
            <option value="new">New</option>
            <option value="in_review">In Review</option>
            <option value="contacted">Contacted</option>
            <option value="closed">Closed</option>
          </select>
          <p className="text-sm text-muted-foreground ml-auto">
            {filtered.length} {filtered.length === 1 ? 'submission' : 'submissions'}
          </p>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="ml-3 text-sm text-muted-foreground">Loading submissions…</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <p className="text-sm text-red-500">{error}</p>
              <button onClick={fetchSubmissions} className="text-sm text-primary underline">Try again</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <svg className="w-10 h-10 text-muted-foreground/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm text-muted-foreground">No submissions found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold whitespace-nowrap">Name</th>
                    <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold whitespace-nowrap">Email</th>
                    <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold whitespace-nowrap">Service Type</th>
                    <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Message Preview</th>
                    <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold whitespace-nowrap">Status</th>
                    <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold whitespace-nowrap">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((sub, i) => (
                    <React.Fragment key={sub.id}>
                      <tr
                        className={`border-b border-border last:border-0 cursor-pointer transition-colors ${
                          i % 2 === 0 ? 'bg-card' : 'bg-secondary/10'
                        } hover:bg-primary/5`}
                        onClick={() => setExpanded(expanded === sub.id ? null : sub.id)}
                      >
                        <td className="px-5 py-4 font-medium text-foreground whitespace-nowrap">
                          <div>{sub.name}</div>
                          {sub.firm && <div className="text-xs text-muted-foreground mt-0.5">{sub.firm}</div>}
                        </td>
                        <td className="px-5 py-4 text-muted-foreground whitespace-nowrap">
                          <a
                            href={`mailto:${sub.email}`}
                            onClick={(e) => e.stopPropagation()}
                            className="hover:text-primary transition-colors"
                          >
                            {sub.email}
                          </a>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground border border-border">
                            {sub.service || '—'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-muted-foreground max-w-xs">
                          <span className="line-clamp-2">{truncate(sub.message, 100)}</span>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[sub.status] ?? STATUS_COLORS['new']}`}>
                            {STATUS_LABELS[sub.status] ?? sub.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-muted-foreground whitespace-nowrap text-xs">
                          {formatDate(sub.created_at)}
                        </td>
                      </tr>
                      {expanded === sub.id && (
                        <tr className="border-b border-border bg-primary/5">
                          <td colSpan={6} className="px-5 py-4">
                            <div className="space-y-2">
                              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Full Message</p>
                              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{sub.message}</p>
                              <div className="flex gap-4 pt-2">
                                <a
                                  href={`mailto:${sub.email}?subject=Re: Your Inquiry — ${sub.service}`}
                                  className="text-xs text-primary hover:underline font-medium"
                                >
                                  Reply via Email →
                                </a>
                                <Link
                                  href="/admin"
                                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Manage in Admin →
                                </Link>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
