'use client';

import React, { useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ConflictMatch {
  source: 'airtable' | 'clio' | 'supabase';
  name: string;
  email?: string;
  firm?: string;
  matchType: 'exact' | 'partial';
  details?: string;
}

interface ConflictCheckResult {
  conflictFound: boolean;
  matches: ConflictMatch[];
  checkedAt: string;
}

interface ConflictCheckerProps {
  inquiryId?: string;
  onComplete?: (result: ConflictCheckResult) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ConflictOfInterestChecker({ inquiryId, onComplete }: ConflictCheckerProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [firm, setFirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ConflictCheckResult | null>(null);
  const [error, setError] = useState('');
  const supabase = createClient();

  const runCheck = useCallback(async () => {
    if (!name.trim()) {
      setError('Client name is required.');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);

    const matches: ConflictMatch[] = [];

    try {
      // ── 1. Check Supabase contact_inquiries ──────────────────────────────────
      const { data: inquiries } = await supabase
        .from('contact_inquiries')
        .select('id, name, email, service')
        .or(
          [
            `name.ilike.%${name.trim()}%`,
            email ? `email.ilike.%${email.trim()}%` : null,
          ]
            .filter(Boolean)
            .join(',')
        )
        .limit(20);

      (inquiries ?? []).forEach((inq) => {
        const isExact =
          inq.name?.toLowerCase() === name.trim().toLowerCase() ||
          (email && inq.email?.toLowerCase() === email.trim().toLowerCase());
        matches.push({
          source: 'supabase',
          name: inq.name ?? 'Unknown',
          email: inq.email ?? undefined,
          matchType: isExact ? 'exact' : 'partial',
          details: `Existing inquiry — Service: ${inq.service ?? 'N/A'}`,
        });
      });

      // ── 2. Check Clio contacts table ─────────────────────────────────────────
      const { data: clioContacts } = await supabase
        .from('clio_contacts')
        .select('id, name, email, type')
        .or(
          [
            `name.ilike.%${name.trim()}%`,
            email ? `email.ilike.%${email.trim()}%` : null,
          ]
            .filter(Boolean)
            .join(',')
        )
        .limit(20);

      (clioContacts ?? []).forEach((c) => {
        const isExact =
          c.name?.toLowerCase() === name.trim().toLowerCase() ||
          (email && c.email?.toLowerCase() === email.trim().toLowerCase());
        matches.push({
          source: 'clio',
          name: c.name ?? 'Unknown',
          email: c.email ?? undefined,
          matchType: isExact ? 'exact' : 'partial',
          details: `Clio contact — Type: ${c.type ?? 'N/A'}`,
        });
      });

      // ── 3. Check Airtable via API ─────────────────────────────────────────────
      try {
        const airtableRes = await fetch('/api/lexi/conflict-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), email: email.trim(), firm: firm.trim() }),
        });
        if (airtableRes.ok) {
          const airtableData = await airtableRes.json();
          (airtableData.matches ?? []).forEach((m: ConflictMatch) => {
            matches.push({ ...m, source: 'airtable' });
          });
        }
      } catch {
        // Airtable check is best-effort
      }

      const conflictFound = matches.some((m) => m.matchType === 'exact');
      const checkResult: ConflictCheckResult = {
        conflictFound,
        matches,
        checkedAt: new Date().toISOString(),
      };

      // ── 4. Log to Supabase ────────────────────────────────────────────────────
      await supabase.from('conflict_check_logs').insert({
        checked_name: name.trim(),
        checked_email: email.trim() || null,
        checked_firm: firm.trim() || null,
        airtable_matches: matches.filter((m) => m.source === 'airtable'),
        clio_matches: matches.filter((m) => m.source === 'clio'),
        supabase_matches: matches.filter((m) => m.source === 'supabase'),
        conflict_found: conflictFound,
        conflict_details: conflictFound
          ? matches
              .filter((m) => m.matchType === 'exact')
              .map((m) => `${m.source}: ${m.name}`)
              .join('; ')
          : null,
        inquiry_id: inquiryId ?? null,
      });

      setResult(checkResult);
      onComplete?.(checkResult);
    } catch (err) {
      setError('Conflict check failed. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [name, email, firm, inquiryId, onComplete, supabase]);

  const sourceLabel = (source: ConflictMatch['source']) => {
    switch (source) {
      case 'airtable': return { label: 'Airtable CRM', color: '#1d4ed8' };
      case 'clio': return { label: 'Clio', color: '#7c3aed' };
      case 'supabase': return { label: 'Internal DB', color: '#355E3B' };
    }
  };

  return (
    <div className="rounded-2xl border bg-white p-6 space-y-5" style={{ borderColor: '#D9D0C5' }}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#FEF3C7' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </div>
        <div>
          <h3 className="font-bold text-slate-900">Conflict of Interest Checker</h3>
          <p className="text-xs text-slate-500">Cross-references Airtable CRM, Clio, and internal database</p>
        </div>
      </div>

      {/* Form */}
      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1 text-slate-600">Client Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            className="w-full text-sm px-3 py-2 rounded-lg border outline-none focus:ring-2"
            style={{ borderColor: '#D9D0C5', color: '#2C1F14' }}
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1 text-slate-600">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="client@email.com"
            className="w-full text-sm px-3 py-2 rounded-lg border outline-none focus:ring-2"
            style={{ borderColor: '#D9D0C5', color: '#2C1F14' }}
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1 text-slate-600">Firm / Company</label>
          <input
            type="text"
            value={firm}
            onChange={(e) => setFirm(e.target.value)}
            placeholder="Optional"
            className="w-full text-sm px-3 py-2 rounded-lg border outline-none focus:ring-2"
            style={{ borderColor: '#D9D0C5', color: '#2C1F14' }}
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        onClick={runCheck}
        disabled={loading || !name.trim()}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 hover:opacity-90"
        style={{ background: '#4A3728' }}
      >
        {loading ? (
          <>
            <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            Checking…
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            Run Conflict Check
          </>
        )}
      </button>

      {/* Results */}
      {result && (
        <div className="space-y-3">
          {/* Status banner */}
          <div
            className="flex items-center gap-3 p-4 rounded-xl"
            style={{
              background: result.conflictFound ? '#FEF2F2' : '#F0FDF4',
              border: `1px solid ${result.conflictFound ? '#FECACA' : '#BBF7D0'}`,
            }}
          >
            <span className="text-2xl">{result.conflictFound ? '⚠️' : '✅'}</span>
            <div>
              <p className="font-semibold text-sm" style={{ color: result.conflictFound ? '#991B1B' : '#166534' }}>
                {result.conflictFound
                  ? 'Potential Conflict Detected — Review Before Onboarding'
                  : 'No Conflicts Found — Clear to Onboard'}
              </p>
              <p className="text-xs" style={{ color: result.conflictFound ? '#B91C1C' : '#15803D' }}>
                {result.matches.length} record{result.matches.length !== 1 ? 's' : ''} found across all sources
              </p>
            </div>
          </div>

          {/* Match list */}
          {result.matches.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Matches Found</p>
              {result.matches.map((match, i) => {
                const src = sourceLabel(match.source);
                return (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg border" style={{ borderColor: '#E5E7EB' }}>
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full text-white flex-shrink-0 mt-0.5"
                      style={{ background: src.color }}
                    >
                      {src.label}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">{match.name}</p>
                      {match.email && <p className="text-xs text-slate-500">{match.email}</p>}
                      {match.details && <p className="text-xs text-slate-400">{match.details}</p>}
                    </div>
                    <span
                      className="ml-auto text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{
                        background: match.matchType === 'exact' ? '#FEE2E2' : '#FEF3C7',
                        color: match.matchType === 'exact' ? '#991B1B' : '#92400E',
                      }}
                    >
                      {match.matchType === 'exact' ? 'Exact' : 'Partial'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-xs text-slate-400">
            Checked at {new Date(result.checkedAt).toLocaleTimeString()} — Results logged to audit trail
          </p>
        </div>
      )}
    </div>
  );
}
