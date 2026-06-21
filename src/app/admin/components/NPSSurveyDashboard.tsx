'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface NPSResponse {
  id: string;
  inquiry_id: string | null;
  client_name: string;
  client_email: string;
  nps_score: number;
  feedback: string | null;
  service: string | null;
  attorney_rating: number | null;
  communication_rating: number | null;
  outcome_rating: number | null;
  would_refer: boolean | null;
  created_at: string;
}

interface SurveyRequest {
  id: string;
  inquiry_id: string;
  client_email: string;
  client_name: string;
  sent_at: string;
  completed_at: string | null;
  token: string;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getNPSCategory(score: number): { label: string; color: string; bg: string } {
  if (score >= 9) return { label: 'Promoter', color: 'text-emerald-700', bg: 'bg-emerald-100' };
  if (score >= 7) return { label: 'Passive', color: 'text-amber-700', bg: 'bg-amber-100' };
  return { label: 'Detractor', color: 'text-red-700', bg: 'bg-red-100' };
}

function exportToCSV(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      headers.map((h) => {
        const val = row[h] ?? '';
        const str = String(val).replace(/"/g, '""');
        return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str;
      }).join(',')
    ),
  ].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportToPDF(
  responses: NPSResponse[],
  npsScore: number,
  avgScore: number,
  responseRate: number,
  promoters: number,
  detractors: number
) {
  const passives = responses.filter(r => r.nps_score >= 7 && r.nps_score <= 8).length;
  const rows = responses.map(r => {
    const cat = getNPSCategory(r.nps_score);
    return `<tr>
      <td>${r.client_name}</td>
      <td>${r.client_email}</td>
      <td>${r.nps_score}/10</td>
      <td>${cat.label}</td>
      <td>${r.would_refer === null ? '—' : r.would_refer ? 'Yes' : 'No'}</td>
      <td>${r.service || '—'}</td>
      <td>${r.feedback ? r.feedback.replace(/</g, '&lt;').replace(/>/g, '&gt;') : '—'}</td>
      <td>${fmtDate(r.created_at)}</td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>NPS Survey Report</title>
  <style>
    body { font-family: Georgia, serif; color: #1a1a1a; padding: 32px; }
    h1 { font-size: 24px; margin-bottom: 4px; }
    p.sub { color: #666; font-size: 13px; margin-bottom: 24px; }
    .kpis { display: flex; gap: 16px; margin-bottom: 24px; }
    .kpi { border: 1px solid #ddd; border-radius: 8px; padding: 12px 16px; flex: 1; }
    .kpi-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #888; }
    .kpi-value { font-size: 20px; font-weight: 600; margin-top: 4px; }
    .breakdown { display: flex; gap: 12px; margin-bottom: 24px; }
    .seg { border-radius: 8px; padding: 10px 14px; flex: 1; text-align: center; }
    .seg-label { font-size: 11px; color: #555; }
    .seg-val { font-size: 18px; font-weight: 700; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #f5f5f5; text-align: left; padding: 8px 10px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #555; border-bottom: 2px solid #ddd; }
    td { padding: 7px 10px; border-bottom: 1px solid #eee; vertical-align: top; }
    tr:nth-child(even) td { background: #fafafa; }
    .footer { margin-top: 24px; font-size: 11px; color: #999; }
  </style></head><body>
  <h1>Client Satisfaction & NPS Report</h1>
  <p class="sub">Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
  <div class="kpis">
    <div class="kpi"><div class="kpi-label">NPS Score</div><div class="kpi-value">${npsScore > 0 ? '+' : ''}${npsScore}</div></div>
    <div class="kpi"><div class="kpi-label">Avg Rating</div><div class="kpi-value">${avgScore.toFixed(1)}/10</div></div>
    <div class="kpi"><div class="kpi-label">Response Rate</div><div class="kpi-value">${responseRate}%</div></div>
    <div class="kpi"><div class="kpi-label">Total Responses</div><div class="kpi-value">${responses.length}</div></div>
  </div>
  <div class="breakdown">
    <div class="seg" style="background:#d1fae5;"><div class="seg-label">Promoters (9-10)</div><div class="seg-val" style="color:#065f46;">${promoters}</div></div>
    <div class="seg" style="background:#fef3c7;"><div class="seg-label">Passives (7-8)</div><div class="seg-val" style="color:#92400e;">${passives}</div></div>
    <div class="seg" style="background:#fee2e2;"><div class="seg-label">Detractors (1-6)</div><div class="seg-val" style="color:#991b1b;">${detractors}</div></div>
  </div>
  <table>
    <thead><tr><th>Client</th><th>Email</th><th>Score</th><th>Category</th><th>Would Refer</th><th>Service</th><th>Feedback</th><th>Date</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">Broussard Legal Services</div>
  </body></html>`;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 500);
}

export default function NPSSurveyDashboard() {
  const [responses, setResponses] = useState<NPSResponse[]>([]);
  const [requests, setRequests] = useState<SurveyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'responses' | 'send'>('overview');
  const [sendForm, setSendForm] = useState({ clientName: '', clientEmail: '', inquiryId: '', service: '' });
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [inquiries, setInquiries] = useState<Array<{ id: string; name: string; email: string; service: string }>>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const [responsesRes, requestsRes, inquiriesRes] = await Promise.all([
        supabase.from('nps_responses').select('*').order('created_at', { ascending: false }),
        supabase.from('nps_survey_requests').select('*').order('sent_at', { ascending: false }).limit(50),
        supabase.from('contact_inquiries').select('id, name, email, service').eq('status', 'closed').order('updated_at', { ascending: false }).limit(50),
      ]);
      setResponses(responsesRes.data || []);
      setRequests(requestsRes.data || []);
      setInquiries(inquiriesRes.data || []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSendSurvey = async () => {
    if (!sendForm.clientEmail || !sendForm.clientName) return;
    setSending(true);
    setSendSuccess(false);
    try {
      const supabase = createClient();
      const token = `nps_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      await supabase.from('nps_survey_requests').insert({
        inquiry_id: sendForm.inquiryId || null,
        client_email: sendForm.clientEmail,
        client_name: sendForm.clientName,
        token,
        sent_at: new Date().toISOString(),
      });
      setSendSuccess(true);
      setSendForm({ clientName: '', clientEmail: '', inquiryId: '', service: '' });
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to send survey');
    } finally {
      setSending(false);
    }
  };

  // NPS Calculation
  const promoters = responses.filter(r => r.nps_score >= 9).length;
  const detractors = responses.filter(r => r.nps_score <= 6).length;
  const npsScore = responses.length > 0 ? Math.round(((promoters - detractors) / responses.length) * 100) : 0;
  const avgScore = responses.length > 0 ? responses.reduce((s, r) => s + r.nps_score, 0) / responses.length : 0;
  const responseRate = requests.length > 0 ? Math.round((responses.length / requests.length) * 100) : 0;
  const wouldRefer = responses.filter(r => r.would_refer).length;

  // Score distribution
  const distribution = Array.from({ length: 10 }, (_, i) => ({
    score: i + 1,
    count: responses.filter(r => r.nps_score === i + 1).length,
  }));

  const handleExportCSV = () => {
    exportToCSV(responses.map(r => ({
      'Client Name': r.client_name,
      'Client Email': r.client_email,
      'NPS Score': r.nps_score,
      'Category': getNPSCategory(r.nps_score).label,
      'Would Refer': r.would_refer === null ? '' : r.would_refer ? 'Yes' : 'No',
      'Service': r.service || '',
      'Attorney Rating': r.attorney_rating ?? '',
      'Communication Rating': r.communication_rating ?? '',
      'Outcome Rating': r.outcome_rating ?? '',
      'Feedback': r.feedback || '',
      'Date': fmtDate(r.created_at),
    })), `nps-survey-responses-${new Date().toISOString().split('T')[0]}.csv`);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-serif text-2xl text-foreground">Client Satisfaction & NPS</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Post-matter surveys, NPS tracking, and client feedback</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExportCSV}
            disabled={responses.length === 0}
            className="px-3 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            CSV
          </button>
          <button
            onClick={() => exportToPDF(responses, npsScore, avgScore, responseRate, promoters, detractors)}
            disabled={responses.length === 0}
            className="px-3 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            PDF
          </button>
          <button onClick={fetchData} className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'NPS Score', value: `${npsScore > 0 ? '+' : ''}${npsScore}`, color: npsScore >= 50 ? 'text-emerald-700' : npsScore >= 0 ? 'text-amber-700' : 'text-red-700', bg: npsScore >= 50 ? 'bg-emerald-50 border-emerald-200' : npsScore >= 0 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200' },
          { label: 'Avg Rating', value: `${avgScore.toFixed(1)}/10`, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
          { label: 'Response Rate', value: `${responseRate}%`, color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
          { label: 'Would Refer', value: `${wouldRefer}/${responses.length}`, color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
        ].map(k => (
          <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">{k.label}</p>
            <p className={`text-2xl font-semibold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {(['overview', 'responses', 'send'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-2.5 text-sm font-semibold capitalize border-b-2 transition-all ${activeTab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>{t === 'send' ? 'Send Survey' : t}</button>
        ))}
      </div>

      {loading ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : activeTab === 'overview' ? (
        <div className="space-y-6">
          {/* Score distribution */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h3 className="font-serif text-lg text-foreground mb-4">Score Distribution</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={distribution} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="score" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }} />
                <Bar dataKey="count" name="Responses" radius={[4, 4, 0, 0]}>
                  {distribution.map((d, i) => (
                    <Cell key={i} fill={d.score >= 9 ? '#355E3B' : d.score >= 7 ? '#C8965A' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-3 justify-center">
              {[{ label: 'Promoters (9-10)', color: 'bg-emerald-500', count: promoters }, { label: 'Passives (7-8)', color: 'bg-amber-500', count: responses.filter(r => r.nps_score >= 7 && r.nps_score <= 8).length }, { label: 'Detractors (1-6)', color: 'bg-red-500', count: detractors }].map(c => (
                <div key={c.label} className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${c.color}`} />
                  <span className="text-xs text-muted-foreground">{c.label}: <strong className="text-foreground">{c.count}</strong></span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent feedback */}
          {responses.filter(r => r.feedback).slice(0, 3).length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-6">
              <h3 className="font-serif text-lg text-foreground mb-4">Recent Feedback</h3>
              <div className="space-y-3">
                {responses.filter(r => r.feedback).slice(0, 3).map(r => {
                  const cat = getNPSCategory(r.nps_score);
                  return (
                    <div key={r.id} className="p-4 rounded-xl bg-secondary/30 border border-border">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-semibold text-foreground">{r.client_name}</p>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cat.bg} ${cat.color}`}>{cat.label}</span>
                          <span className="text-sm font-bold text-foreground">{r.nps_score}/10</span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground italic">&ldquo;{r.feedback}&rdquo;</p>
                      <p className="text-xs text-muted-foreground mt-1">{fmtDate(r.created_at)}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : activeTab === 'responses' ? (
        responses.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-12 text-center text-muted-foreground text-sm">No survey responses yet. Send surveys to closed matters to collect feedback.</div>
        ) : (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/40">
                    <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Client</th>
                    <th className="text-center px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">NPS</th>
                    <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden md:table-cell">Feedback</th>
                    <th className="text-center px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden sm:table-cell">Would Refer</th>
                    <th className="text-right px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {responses.map((r, i) => {
                    const cat = getNPSCategory(r.nps_score);
                    return (
                      <tr key={r.id} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-foreground">{r.client_name}</p>
                          <p className="text-xs text-muted-foreground">{r.client_email}</p>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-lg font-bold text-foreground">{r.nps_score}</span>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cat.bg} ${cat.color}`}>{cat.label}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 hidden md:table-cell">
                          <p className="text-xs text-muted-foreground line-clamp-2">{r.feedback || '—'}</p>
                        </td>
                        <td className="px-5 py-3.5 text-center hidden sm:table-cell">
                          {r.would_refer === null ? <span className="text-muted-foreground">—</span> : r.would_refer ? <span className="text-emerald-600">✓ Yes</span> : <span className="text-red-500">✗ No</span>}
                        </td>
                        <td className="px-5 py-3.5 text-right text-xs text-muted-foreground">{fmtDate(r.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        <div className="bg-card border border-border rounded-2xl p-6 max-w-lg">
          <h3 className="font-serif text-lg text-foreground mb-4">Send NPS Survey</h3>
          {sendSuccess && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm">Survey request created successfully!</div>
          )}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Client Name *</label>
              <input value={sendForm.clientName} onChange={e => setSendForm(f => ({ ...f, clientName: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-border bg-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="Jane Smith" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Client Email *</label>
              <input type="email" value={sendForm.clientEmail} onChange={e => setSendForm(f => ({ ...f, clientEmail: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-border bg-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="jane@example.com" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Linked Matter (optional)</label>
              <select value={sendForm.inquiryId} onChange={e => setSendForm(f => ({ ...f, inquiryId: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-border bg-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option value="">— Select matter —</option>
                {inquiries.map(i => <option key={i.id} value={i.id}>{i.name} · {i.service}</option>)}
              </select>
            </div>
            <button onClick={handleSendSurvey} disabled={sending || !sendForm.clientEmail || !sendForm.clientName} className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed" style={{ background: '#355E3B' }}>
              {sending ? 'Creating Survey...' : 'Create Survey Link'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
