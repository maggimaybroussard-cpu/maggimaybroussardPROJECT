'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface ConflictSource {
  source: 'supabase' | 'airtable' | 'clio';
  label: string;
  icon: string;
}

interface ConflictMatch {
  source: string;
  type: 'existing_client' | 'opposing_party' | 'firm_match' | 'email_match';
  description: string;
  record_id?: string;
  severity: 'high' | 'medium' | 'low';
  details?: Record<string, string>;
}

interface CheckResult {
  checkedName: string;
  checkedEmail: string;
  checkedFirm: string;
  opposingParty: string;
  conflicts: ConflictMatch[];
  riskLevel: 'none' | 'low' | 'medium' | 'high';
  checkedAt: string;
  sourcesChecked: string[];
}

interface PastCheck {
  id: string;
  checked_name: string;
  checked_email: string | null;
  checked_entity: string | null;
  opposing_party: string | null;
  conflicts_found: ConflictMatch[];
  conflict_count: number;
  risk_level: string;
  created_at: string;
}

const RISK_STYLES: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  none: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
  low: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' },
  medium: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700' },
  high: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700' },
};

const SEVERITY_ICONS: Record<string, string> = {
  high: '🔴',
  medium: '🟡',
  low: '🟢',
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function ConflictOfInterestChecker() {
  const supabase = createClient();

  const [form, setForm] = useState({
    name: '',
    email: '',
    firm: '',
    opposingParty: '',
    opposingFirm: '',
    serviceType: '',
  });

  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [pastChecks, setPastChecks] = useState<PastCheck[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Source status
  const [sourceStatus, setSourceStatus] = useState<Record<string, 'checking' | 'ok' | 'error' | 'idle'>>({
    supabase: 'idle',
    airtable: 'idle',
    clio: 'idle',
  });

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const { data } = await supabase
        .from('conflict_checks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(25);
      setPastChecks((data || []).map(c => ({ ...c, conflicts_found: c.conflicts_found || [] })));
    } catch {
      // silent
    } finally {
      setLoadingHistory(false);
    }
  }, [supabase]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const runCheck = async () => {
    if (!form.name.trim()) {
      setError('Client name is required');
      return;
    }
    setChecking(true);
    setError(null);
    setResult(null);
    setSaveSuccess(false);

    const conflicts: ConflictMatch[] = [];
    const sourcesChecked: string[] = [];
    const name = form.name.toLowerCase().trim();
    const email = form.email.toLowerCase().trim();
    const firm = form.firm.toLowerCase().trim();
    const opposing = form.opposingParty.toLowerCase().trim();
    const opposingFirm = form.opposingFirm.toLowerCase().trim();

    // ── 1. Supabase (internal CRM) ────────────────────────────────────────
    setSourceStatus(s => ({ ...s, supabase: 'checking' }));
    try {
      const orClause = email
        ? `name.ilike.%${name}%,email.ilike.%${email}%`
        : `name.ilike.%${name}%`;

      const { data: inquiries } = await supabase
        .from('contact_inquiries')
        .select('id, name, email, service, status')
        .or(orClause)
        .limit(20);

      (inquiries || []).forEach(inq => {
        const nameMatch = inq.name.toLowerCase().includes(name);
        const emailMatch = email && inq.email?.toLowerCase().includes(email);
        if (nameMatch || emailMatch) {
          conflicts.push({
            source: 'Supabase CRM',
            type: emailMatch ? 'email_match' : 'existing_client',
            description: `Existing record: ${inq.name} (${inq.service}) — Status: ${inq.status}`,
            record_id: inq.id,
            severity: emailMatch ? 'high' : 'medium',
            details: { name: inq.name, email: inq.email || '', service: inq.service, status: inq.status },
          });
        }
      });

      // Check opposing party against existing clients
      if (opposing) {
        const { data: oppMatches } = await supabase
          .from('contact_inquiries')
          .select('id, name, email, service')
          .ilike('name', `%${opposing}%`)
          .limit(10);

        (oppMatches || []).forEach(m => {
          conflicts.push({
            source: 'Supabase CRM',
            type: 'opposing_party',
            description: `⚠️ Opposing party "${form.opposingParty}" matches existing client: ${m.name} (${m.service})`,
            record_id: m.id,
            severity: 'high',
            details: { name: m.name, service: m.service },
          });
        });
      }

      sourcesChecked.push('Internal CRM (Supabase)');
      setSourceStatus(s => ({ ...s, supabase: 'ok' }));
    } catch {
      setSourceStatus(s => ({ ...s, supabase: 'error' }));
    }

    // ── 2. Airtable CRM ───────────────────────────────────────────────────
    setSourceStatus(s => ({ ...s, airtable: 'checking' }));
    try {
      const res = await fetch('/api/lexi/airtable-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'conflict_check',
          name: form.name,
          email: form.email,
          firm: form.firm,
          opposingParty: form.opposingParty,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.conflicts && Array.isArray(data.conflicts)) {
          data.conflicts.forEach((c: { name?: string; email?: string; firm?: string; record_id?: string }) => {
            conflicts.push({
              source: 'Airtable CRM',
              type: 'existing_client',
              description: `Airtable record match: ${c.name || 'Unknown'} ${c.email ? `(${c.email})` : ''} ${c.firm ? `— ${c.firm}` : ''}`,
              record_id: c.record_id,
              severity: 'medium',
              details: { name: c.name || '', email: c.email || '', firm: c.firm || '' },
            });
          });
        }
        sourcesChecked.push('Airtable CRM');
        setSourceStatus(s => ({ ...s, airtable: 'ok' }));
      } else {
        setSourceStatus(s => ({ ...s, airtable: 'error' }));
      }
    } catch {
      setSourceStatus(s => ({ ...s, airtable: 'error' }));
    }

    // ── 3. Clio (via Broussard API proxy) ─────────────────────────────────
    setSourceStatus(s => ({ ...s, clio: 'checking' }));
    try {
      const clioRes = await fetch('/api/broussard/test-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'conflict_check',
          name: form.name,
          email: form.email,
          firm: form.firm,
          opposingParty: form.opposingParty,
        }),
      });

      if (clioRes.ok) {
        const clioData = await clioRes.json();
        if (clioData.conflicts && Array.isArray(clioData.conflicts)) {
          clioData.conflicts.forEach((c: { name?: string; email?: string; firm?: string; matter_id?: string }) => {
            conflicts.push({
              source: 'Clio',
              type: c.firm ? 'firm_match' : 'existing_client',
              description: `Clio contact match: ${c.name || 'Unknown'} ${c.firm ? `at ${c.firm}` : ''} ${c.email ? `(${c.email})` : ''}`,
              record_id: c.matter_id,
              severity: 'medium',
              details: { name: c.name || '', email: c.email || '', firm: c.firm || '' },
            });
          });
        }
        sourcesChecked.push('Clio');
        setSourceStatus(s => ({ ...s, clio: 'ok' }));
      } else {
        setSourceStatus(s => ({ ...s, clio: 'error' }));
        sourcesChecked.push('Clio (unavailable)');
      }
    } catch {
      setSourceStatus(s => ({ ...s, clio: 'error' }));
      sourcesChecked.push('Clio (unavailable)');
    }

    // ── Firm name cross-check ─────────────────────────────────────────────
    if (firm) {
      try {
        const { data: firmMatches } = await supabase
          .from('contact_inquiries')
          .select('id, name, email, service')
          .ilike('service', `%${firm}%`)
          .limit(10);

        (firmMatches || []).forEach(m => {
          if (!conflicts.some(c => c.record_id === m.id)) {
            conflicts.push({
              source: 'Supabase CRM',
              type: 'firm_match',
              description: `Firm name "${form.firm}" appears in existing matter: ${m.name} (${m.service})`,
              record_id: m.id,
              severity: 'low',
              details: { name: m.name, service: m.service },
            });
          }
        });
      } catch {
        // silent
      }
    }

    // ── Compute risk level ────────────────────────────────────────────────
    const highCount = conflicts.filter(c => c.severity === 'high').length;
    const medCount = conflicts.filter(c => c.severity === 'medium').length;
    const riskLevel: CheckResult['riskLevel'] =
      highCount > 0 ? 'high' : medCount > 0 ? 'medium' : conflicts.length > 0 ? 'low' : 'none';

    const checkResult: CheckResult = {
      checkedName: form.name,
      checkedEmail: form.email,
      checkedFirm: form.firm,
      opposingParty: form.opposingParty,
      conflicts,
      riskLevel,
      checkedAt: new Date().toISOString(),
      sourcesChecked,
    };

    setResult(checkResult);
    setChecking(false);

    // ── Save to Supabase ──────────────────────────────────────────────────
    setSaving(true);
    try {
      await supabase.from('conflict_checks').insert({
        checked_name: form.name,
        checked_email: form.email || null,
        checked_entity: form.firm || null,
        opposing_party: form.opposingParty || null,
        service_type: form.serviceType || null,
        conflicts_found: conflicts,
        conflict_count: conflicts.length,
        risk_level: riskLevel,
        checked_by: 'Admin',
        notes: `Sources checked: ${sourcesChecked.join(', ')}`,
      });
      setSaveSuccess(true);
      await loadHistory();
    } catch {
      // silent save failure
    } finally {
      setSaving(false);
    }
  };

  const riskStyle = result ? RISK_STYLES[result.riskLevel] : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          🔍 Conflict of Interest Checker
        </h3>
        <p className="text-sm text-slate-500 mt-0.5">
          Cross-references Internal CRM, Airtable, and Clio before onboarding a new client.
        </p>
      </div>

      {/* Paralegal Disclaimer */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <p className="text-amber-800 text-xs leading-relaxed">
          <strong>⚖️ Paralegal Notice:</strong> This conflict check is a preliminary screening tool performed under attorney supervision. A licensed attorney must review all conflict check results before accepting or declining representation. This tool does not constitute legal advice or a formal conflict clearance.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Check Form */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
          <h4 className="font-semibold text-slate-800">New Client Conflict Check</h4>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-700 flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">✕</button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
                Prospective Client Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Full legal name"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Email Address</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="client@example.com"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Law Firm / Company</label>
              <input
                type="text"
                value={form.firm}
                onChange={e => setForm(p => ({ ...p, firm: e.target.value }))}
                placeholder="Firm or organization name"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Opposing Party</label>
              <input
                type="text"
                value={form.opposingParty}
                onChange={e => setForm(p => ({ ...p, opposingParty: e.target.value }))}
                placeholder="Opposing party name"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Opposing Firm</label>
              <input
                type="text"
                value={form.opposingFirm}
                onChange={e => setForm(p => ({ ...p, opposingFirm: e.target.value }))}
                placeholder="Opposing counsel's firm"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Service / Matter Type</label>
              <input
                type="text"
                value={form.serviceType}
                onChange={e => setForm(p => ({ ...p, serviceType: e.target.value }))}
                placeholder="e.g. Business Litigation"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
              />
            </div>
          </div>

          {/* Source indicators */}
          <div className="flex flex-wrap gap-2 pt-1">
            {[
              { key: 'supabase', label: 'Internal CRM', icon: '🗄️' },
              { key: 'airtable', label: 'Airtable', icon: '📊' },
              { key: 'clio', label: 'Clio', icon: '⚖️' },
            ].map(src => (
              <div key={src.key} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-all ${
                sourceStatus[src.key] === 'checking' ? 'bg-blue-50 border-blue-200 text-blue-600' :
                sourceStatus[src.key] === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' :
                sourceStatus[src.key] === 'error'? 'bg-red-50 border-red-200 text-red-500' : 'bg-slate-50 border-slate-200 text-slate-500'
              }`}>
                <span>{src.icon}</span>
                <span>{src.label}</span>
                {sourceStatus[src.key] === 'checking' && (
                  <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                )}
                {sourceStatus[src.key] === 'ok' && <span>✓</span>}
                {sourceStatus[src.key] === 'error' && <span>✗</span>}
              </div>
            ))}
          </div>

          <button
            onClick={runCheck}
            disabled={checking || !form.name.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #1b2a4a 0%, #2d4a7a 100%)' }}
          >
            {checking ? (
              <>
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Scanning All Sources…
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                Run Conflict Check
              </>
            )}
          </button>
        </div>

        {/* Results Panel */}
        <div className="space-y-4">
          {result && riskStyle && (
            <div className={`rounded-2xl border p-5 ${riskStyle.bg} ${riskStyle.border}`}>
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h4 className={`font-bold text-base ${riskStyle.text}`}>
                    {result.riskLevel === 'none' ? '✅ No Conflicts Found' : `⚠️ ${result.conflicts.length} Conflict${result.conflicts.length !== 1 ? 's' : ''} Detected`}
                  </h4>
                  <p className={`text-xs mt-0.5 ${riskStyle.text} opacity-80`}>
                    Checked: {result.checkedName}{result.checkedEmail ? ` · ${result.checkedEmail}` : ''}{result.checkedFirm ? ` · ${result.checkedFirm}` : ''}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${riskStyle.badge}`}>
                  {result.riskLevel} Risk
                </span>
              </div>

              {result.conflicts.length > 0 ? (
                <div className="space-y-2">
                  {result.conflicts.map((c, i) => (
                    <div key={i} className="bg-white/70 rounded-xl p-3 border border-white/50">
                      <div className="flex items-start gap-2">
                        <span className="text-sm shrink-0 mt-0.5">{SEVERITY_ICONS[c.severity]}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-700">{c.description}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{c.source}</span>
                            <span className="text-[10px] text-slate-400">{c.type.replace(/_/g, ' ')}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white/70 rounded-xl p-4 text-center">
                  <p className="text-emerald-700 text-sm font-medium">✓ Clear to proceed with onboarding</p>
                  <p className="text-emerald-600 text-xs mt-1">No matching records found across {result.sourcesChecked.length} sources</p>
                </div>
              )}

              <div className="mt-3 pt-3 border-t border-white/40 flex flex-wrap gap-1.5">
                {result.sourcesChecked.map(s => (
                  <span key={s} className="text-[10px] text-slate-500 bg-white/60 px-2 py-0.5 rounded-full">{s}</span>
                ))}
              </div>

              {saveSuccess && (
                <p className="text-xs text-emerald-600 mt-2 text-center">✓ Check saved to history</p>
              )}
            </div>
          )}

          {/* Past Checks */}
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h4 className="font-semibold text-slate-800 text-sm">Recent Conflict Checks</h4>
            </div>
            {loadingHistory ? (
              <div className="p-6 text-center text-slate-400 text-sm">Loading history…</div>
            ) : pastChecks.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-sm">No checks run yet.</div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                {pastChecks.map(c => {
                  const style = RISK_STYLES[c.risk_level] || RISK_STYLES.none;
                  return (
                    <div key={c.id} className="px-5 py-3.5 hover:bg-slate-50/50 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800 text-sm truncate">{c.checked_name}</p>
                          {c.checked_email && <p className="text-xs text-slate-400 truncate">{c.checked_email}</p>}
                          {c.opposing_party && <p className="text-xs text-slate-400">vs. {c.opposing_party}</p>}
                          <p className="text-[10px] text-slate-300 mt-0.5">{fmtDate(c.created_at)}</p>
                        </div>
                        <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${style.badge}`}>
                          {c.risk_level === 'none' ? '✓ Clear' : `${c.conflict_count} conflict${c.conflict_count !== 1 ? 's' : ''}`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
