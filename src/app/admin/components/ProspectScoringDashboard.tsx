'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProspectScore {
  id: string;
  submission_id: string | null;
  inquiry_id: string | null;
  email: string;
  name: string;
  complexity_score: number;
  budget_score: number;
  engagement_score: number;
  total_score: number;
  score_tier: 'hot' | 'warm' | 'cold';
  signals: {
    complexity: string[];
    budget: string[];
    engagement: string[];
  };
  recommended_action: string | null;
  scored_at: string;
  created_at: string;
  intake_submissions?: {
    case_type: string;
    urgency: string;
    firm_name: string | null;
    phone: string | null;
  } | null;
}

interface ScoreStats {
  total: number;
  hot: number;
  warm: number;
  cold: number;
  avgScore: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function tierBadge(tier: 'hot' | 'warm' | 'cold') {
  if (tier === 'hot') return 'bg-red-100 text-red-700 border-red-200';
  if (tier === 'warm') return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-blue-100 text-blue-600 border-blue-200';
}

function tierDot(tier: 'hot' | 'warm' | 'cold') {
  if (tier === 'hot') return 'bg-red-500';
  if (tier === 'warm') return 'bg-amber-500';
  return 'bg-blue-400';
}

function scoreFill(score: number) {
  if (score >= 70) return '#ef4444';
  if (score >= 45) return '#f59e0b';
  return '#60a5fa';
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-semibold text-foreground">{score}</span>
      </div>
      <div className="h-1.5 bg-secondary/50 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ProspectScoringDashboard() {
  const [scores, setScores] = useState<ProspectScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<'all' | 'hot' | 'warm' | 'cold'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [stats, setStats] = useState<ScoreStats>({ total: 0, hot: 0, warm: 0, cold: 0, avgScore: 0 });

  const fetchScores = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: fetchErr } = await supabase
        .from('prospect_scores')
        .select(`
          *,
          intake_submissions (
            case_type,
            urgency,
            firm_name,
            phone
          )
        `)
        .order('total_score', { ascending: false });

      if (fetchErr) throw new Error(fetchErr.message);

      const rows = (data ?? []) as ProspectScore[];
      setScores(rows);

      const hot = rows.filter((r) => r.score_tier === 'hot').length;
      const warm = rows.filter((r) => r.score_tier === 'warm').length;
      const cold = rows.filter((r) => r.score_tier === 'cold').length;
      const avg = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.total_score, 0) / rows.length) : 0;
      setStats({ total: rows.length, hot, warm, cold, avgScore: avg });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load scores');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScores();
  }, [fetchScores]);

  const filtered = scores.filter((s) => {
    const matchesTier = tierFilter === 'all' || s.score_tier === tierFilter;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      s.name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      (s.intake_submissions?.case_type ?? '').toLowerCase().includes(q) ||
      (s.intake_submissions?.firm_name ?? '').toLowerCase().includes(q);
    return matchesTier && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Scored', value: stats.total, color: 'text-foreground', bg: 'bg-card' },
          { label: '🔥 Hot Leads', value: stats.hot, color: 'text-red-600', bg: 'bg-red-50 border-red-100' },
          { label: '🌤 Warm Leads', value: stats.warm, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
          { label: 'Avg Score', value: stats.avgScore, color: 'text-foreground', bg: 'bg-card' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} border border-border rounded-2xl p-5`}>
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">{label}</p>
            <p className={`text-3xl font-semibold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search by name, email, firm, case type…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'hot', 'warm', 'cold'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTierFilter(t)}
              className={`px-4 py-2.5 rounded-xl border text-xs font-semibold uppercase tracking-widest transition-all ${
                tierFilter === t
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card border-border text-muted-foreground hover:border-accent/50'
              }`}
            >
              {t === 'all' ? 'All' : t === 'hot' ? '🔥 Hot' : t === 'warm' ? '🌤 Warm' : '❄️ Cold'}
            </button>
          ))}
        </div>
        <button
          onClick={fetchScores}
          className="px-4 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm font-medium hover:border-accent/50 transition-all flex items-center gap-2 shrink-0"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        </div>
      )}

      {/* Empty */}
      {!loading && !error && filtered.length === 0 && (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <div className="w-14 h-14 rounded-full bg-secondary/50 flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
          </div>
          <p className="font-serif text-xl text-foreground mb-2">No scored prospects yet</p>
          <p className="text-sm text-muted-foreground">Scores are generated automatically when intake forms are submitted.</p>
        </div>
      )}

      {/* Score Cards */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((prospect) => {
            const isExpanded = expandedId === prospect.id;
            const sub = prospect.intake_submissions;
            return (
              <div
                key={prospect.id}
                className="bg-card border border-border rounded-2xl overflow-hidden transition-all duration-200 hover:border-accent/30"
              >
                {/* Row */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : prospect.id)}
                  className="w-full text-left px-6 py-4 flex items-center gap-4"
                >
                  {/* Score circle */}
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 text-white font-bold text-sm"
                    style={{ background: scoreFill(prospect.total_score) }}
                  >
                    {prospect.total_score}
                  </div>

                  {/* Name + email */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-foreground text-sm">{prospect.name}</p>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-semibold ${tierBadge(prospect.score_tier)}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${tierDot(prospect.score_tier)}`} />
                        {prospect.score_tier.charAt(0).toUpperCase() + prospect.score_tier.slice(1)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{prospect.email}</p>
                  </div>

                  {/* Case type + urgency */}
                  <div className="hidden md:block text-right shrink-0">
                    <p className="text-xs font-medium text-foreground">{sub?.case_type ?? '—'}</p>
                    <p className="text-xs text-muted-foreground capitalize">{sub?.urgency ?? '—'}</p>
                  </div>

                  {/* Score bars mini */}
                  <div className="hidden lg:flex flex-col gap-1 w-32 shrink-0">
                    {[
                      { label: 'Complexity', score: prospect.complexity_score },
                      { label: 'Budget', score: prospect.budget_score },
                      { label: 'Engagement', score: prospect.engagement_score },
                    ].map(({ label, score }) => (
                      <div key={label} className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground w-16 shrink-0">{label}</span>
                        <div className="flex-1 h-1 bg-secondary/50 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${score}%`, background: scoreFill(score) }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground w-6 text-right">{score}</span>
                      </div>
                    ))}
                  </div>

                  {/* Date */}
                  <div className="hidden sm:block text-right shrink-0">
                    <p className="text-xs text-muted-foreground">{formatDate(prospect.scored_at)}</p>
                  </div>

                  {/* Chevron */}
                  <svg
                    width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className={`text-muted-foreground shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                  >
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-border px-6 py-5 bg-secondary/10 space-y-5">
                    {/* Recommended action */}
                    {prospect.recommended_action && (
                      <div className="flex items-start gap-3 bg-card border border-border rounded-xl p-4">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(53,94,59,0.12)' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                          </svg>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-widest text-accent mb-1">Recommended Action</p>
                          <p className="text-sm text-foreground">{prospect.recommended_action}</p>
                        </div>
                      </div>
                    )}

                    {/* Score breakdown */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {[
                        { label: 'Case Complexity', score: prospect.complexity_score, signals: prospect.signals?.complexity ?? [] },
                        { label: 'Budget Signals', score: prospect.budget_score, signals: prospect.signals?.budget ?? [] },
                        { label: 'Engagement History', score: prospect.engagement_score, signals: prospect.signals?.engagement ?? [] },
                      ].map(({ label, score, signals }) => (
                        <div key={label} className="bg-card border border-border rounded-xl p-4 space-y-3">
                          <ScoreBar label={label} score={score} color={scoreFill(score)} />
                          <ul className="space-y-1">
                            {signals.map((sig, i) => (
                              <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                                <span className="w-1 h-1 rounded-full bg-muted-foreground/40 mt-1.5 shrink-0" />
                                {sig}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>

                    {/* Contact info */}
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      {sub?.firm_name && (
                        <span className="flex items-center gap-1.5">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                          </svg>
                          {sub.firm_name}
                        </span>
                      )}
                      {sub?.phone && (
                        <span className="flex items-center gap-1.5">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.5a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.69h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                          </svg>
                          {sub.phone}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                        </svg>
                        {prospect.email}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
