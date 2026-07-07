'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface EngagementLetter {
  id: string;
  token: string;
  client_name: string;
  client_email: string;
  retainer_amount: number;
  scope: string;
  fees: string;
  timeline: string;
  next_steps: string;
  status: 'pending' | 'signed' | 'expired';
  signed_at: string | null;
  signer_name: string | null;
  payment_intent_id: string | null;
  created_at: string;
  expires_at: string | null;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://broussardlegalservices.com';

export default function EngagementLettersDashboard() {
  const [letters, setLetters] = useState<EngagementLetter[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'signed' | 'expired'>('all');
  const [selected, setSelected] = useState<EngagementLetter | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateForm, setGenerateForm] = useState({ name: '', email: '', retainer: '250' });
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateSuccess, setGenerateSuccess] = useState<string | null>(null);
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const fetchLetters = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('engagement_letters')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (!error && data) setLetters(data as EngagementLetter[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchLetters(); }, [fetchLetters]);

  const filtered = letters.filter(l => {
    const matchSearch =
      !search ||
      l.client_name.toLowerCase().includes(search.toLowerCase()) ||
      l.client_email.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: letters.length,
    pending: letters.filter(l => l.status === 'pending').length,
    signed: letters.filter(l => l.status === 'signed').length,
    expired: letters.filter(l => l.status === 'expired').length,
  };

  const handleGenerate = async () => {
    setGenerateError(null);
    setGenerateSuccess(null);
    if (!generateForm.name.trim() || !generateForm.email.trim()) {
      setGenerateError('Name and email are required.');
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch('/api/engagement-letter/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: generateForm.name.trim(),
          clientEmail: generateForm.email.trim(),
          retainerAmount: parseFloat(generateForm.retainer) || 250,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGenerateError(data.error ?? 'Failed to generate letter.');
      } else {
        setGenerateSuccess(`Letter generated! Signing link: ${SITE_URL}/engagement-letter/${data.token}`);
        setShowGenerateForm(false);
        setGenerateForm({ name: '', email: '', retainer: '250' });
        fetchLetters();
      }
    } catch {
      setGenerateError('Network error. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(`${SITE_URL}/engagement-letter/${token}`).then(() => {
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    });
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string; label: string }> = {
      pending: { bg: 'rgba(200,150,90,0.12)', text: '#C8965A', label: 'Pending' },
      signed: { bg: 'rgba(53,94,59,0.12)', text: '#355E3B', label: 'Signed' },
      expired: { bg: 'rgba(107,114,128,0.12)', text: '#6b7280', label: 'Expired' },
    };
    const s = map[status] ?? map.pending;
    return (
      <span className="text-xs font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full" style={{ background: s.bg, color: s.text }}>
        {s.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Engagement Letters</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Auto-generated after deposit — review, track, and manage digital signatures</p>
        </div>
        <button
          onClick={() => { setShowGenerateForm(v => !v); setGenerateError(null); setGenerateSuccess(null); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold uppercase tracking-widest hover:opacity-90 transition-all shadow-sm"
          style={{ background: '#355E3B', color: '#fff' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Generate Letter
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total, color: '#355E3B' },
          { label: 'Pending Signature', value: stats.pending, color: '#C8965A' },
          { label: 'Signed', value: stats.signed, color: '#355E3B' },
          { label: 'Expired', value: stats.expired, color: '#6b7280' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-border bg-white p-4">
            <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground mb-1">{label}</p>
            <p className="text-2xl font-semibold" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Generate Form */}
      {showGenerateForm && (
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground mb-4">Generate New Engagement Letter</p>
          <div className="grid md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="text-xs uppercase tracking-widest font-semibold text-muted-foreground block mb-1.5">Client Name</label>
              <input
                type="text"
                value={generateForm.name}
                onChange={e => setGenerateForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Full name"
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest font-semibold text-muted-foreground block mb-1.5">Client Email</label>
              <input
                type="email"
                value={generateForm.email}
                onChange={e => setGenerateForm(f => ({ ...f, email: e.target.value }))}
                placeholder="client@email.com"
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest font-semibold text-muted-foreground block mb-1.5">Retainer Amount ($)</label>
              <input
                type="number"
                value={generateForm.retainer}
                onChange={e => setGenerateForm(f => ({ ...f, retainer: e.target.value }))}
                placeholder="250"
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
          {generateError && (
            <p className="text-xs text-red-600 mb-3">{generateError}</p>
          )}
          {generateSuccess && (
            <div className="rounded-xl px-4 py-3 mb-3 text-xs" style={{ background: 'rgba(53,94,59,0.08)', color: '#355E3B', border: '1px solid rgba(53,94,59,0.2)' }}>
              {generateSuccess}
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="px-5 py-2.5 rounded-full text-sm font-semibold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-60 flex items-center gap-2"
              style={{ background: '#355E3B', color: '#fff' }}
            >
              {generating ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Generating…
                </>
              ) : 'Generate & Send'}
            </button>
            <button onClick={() => setShowGenerateForm(false)} className="px-5 py-2.5 rounded-full text-sm font-semibold uppercase tracking-widest border border-border hover:border-primary/40 transition-all">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="flex-1 min-w-[200px] px-4 py-2.5 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <div className="flex rounded-xl overflow-hidden border border-border">
          {(['all', 'pending', 'signed', 'expired'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="px-4 py-2 text-xs font-semibold uppercase tracking-widest transition-all capitalize"
              style={statusFilter === s ? { background: '#355E3B', color: '#fff' } : { background: 'white', color: '#7A6B5D' }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-muted-foreground">No engagement letters found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'rgba(53,94,59,0.04)', borderBottom: '1px solid rgba(53,94,59,0.1)' }}>
                  {['Client', 'Email', 'Retainer', 'Status', 'Created', 'Signed', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs uppercase tracking-widest font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((letter, i) => (
                  <tr key={letter.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors" style={i % 2 === 0 ? {} : { background: 'rgba(250,247,242,0.5)' }}>
                    <td className="px-4 py-3 font-medium text-foreground">{letter.client_name}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{letter.client_email}</td>
                    <td className="px-4 py-3 font-semibold" style={{ color: '#355E3B' }}>${Number(letter.retainer_amount).toFixed(2)}</td>
                    <td className="px-4 py-3">{statusBadge(letter.status)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(letter.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {letter.signed_at
                        ? new Date(letter.signed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => copyLink(letter.token)}
                          className="text-xs px-3 py-1.5 rounded-full border border-border hover:border-primary/40 transition-all flex items-center gap-1.5"
                          title="Copy signing link"
                        >
                          {copiedToken === letter.token ? (
                            <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg> Copied</>
                          ) : (
                            <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg> Copy Link</>
                          )}
                        </button>
                        <button
                          onClick={() => setSelected(letter)}
                          className="text-xs px-3 py-1.5 rounded-full border border-border hover:border-primary/40 transition-all"
                        >
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 flex items-center justify-between border-b border-border">
              <div>
                <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">Engagement Letter</p>
                <p className="font-semibold text-foreground mt-0.5">{selected.client_name}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Status</span>
                {statusBadge(selected.status)}
              </div>
              {[
                { label: 'Client', value: selected.client_name },
                { label: 'Email', value: selected.client_email },
                { label: 'Retainer Applied', value: `$${Number(selected.retainer_amount).toFixed(2)}` },
                { label: 'Created', value: new Date(selected.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) },
                ...(selected.signed_at ? [{ label: 'Signed', value: new Date(selected.signed_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }] : []),
                ...(selected.signer_name ? [{ label: 'Signed By', value: selected.signer_name }] : []),
                ...(selected.payment_intent_id ? [{ label: 'Payment Intent', value: selected.payment_intent_id }] : []),
              ].map(({ label, value }) => (
                <div key={label} className="flex items-start justify-between py-2 border-b border-border/50">
                  <span className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">{label}</span>
                  <span className="text-sm text-foreground text-right max-w-[60%] font-mono text-xs">{value}</span>
                </div>
              ))}

              <div>
                <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground mb-2">Signing Link</p>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={`${SITE_URL}/engagement-letter/${selected.token}`}
                    className="flex-1 px-3 py-2 rounded-xl border border-border bg-muted/30 text-xs font-mono"
                  />
                  <button
                    onClick={() => copyLink(selected.token)}
                    className="px-3 py-2 rounded-xl border border-border hover:border-primary/40 transition-all text-xs font-semibold"
                  >
                    {copiedToken === selected.token ? '✓' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground mb-2">Scope</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{selected.scope}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
