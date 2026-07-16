'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  events: string[];
  is_active: boolean;
  secret: string | null;
  last_triggered_at: string | null;
  success_count: number;
  failure_count: number;
  created_at: string;
}

interface WebhookLog {
  id: string;
  webhook_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  status: 'success' | 'failed';
  response_code: number | null;
  error_message: string | null;
  created_at: string;
}

const AVAILABLE_EVENTS = [
  { id: 'case.created', label: 'Case Created', description: 'New inquiry/case submitted' },
  { id: 'case.status_changed', label: 'Case Status Changed', description: 'Case status updated' },
  { id: 'invoice.created', label: 'Invoice Created', description: 'New invoice generated' },
  { id: 'invoice.paid', label: 'Invoice Paid', description: 'Invoice marked as paid' },
  { id: 'booking.confirmed', label: 'Booking Confirmed', description: 'Consultation booked' },
  { id: 'document.uploaded', label: 'Document Uploaded', description: 'New document added to case' },
  { id: 'retainer.low_balance', label: 'Retainer Low Balance', description: 'Retainer below threshold' },
  { id: 'nps.submitted', label: 'NPS Survey Submitted', description: 'Client satisfaction survey received' },
];

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function OutboundWebhooksDashboard() {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEndpoint, setNewEndpoint] = useState({ name: '', url: '', events: [] as string[] });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'endpoints' | 'logs'>('endpoints');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const [endpointsRes, logsRes] = await Promise.all([
        supabase.from('webhook_endpoints').select('*').order('created_at', { ascending: false }),
        supabase.from('webhook_logs').select('*').order('created_at', { ascending: false }).limit(50),
      ]);
      setEndpoints(endpointsRes.data || []);
      setLogs(logsRes.data || []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAdd = async () => {
    if (!newEndpoint.name || !newEndpoint.url || newEndpoint.events.length === 0) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const secret = `whsec_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
      const { error } = await supabase.from('webhook_endpoints').insert({
        name: newEndpoint.name,
        url: newEndpoint.url,
        events: newEndpoint.events,
        is_active: true,
        secret,
        success_count: 0,
        failure_count: 0,
      });
      if (error) throw error;
      setShowAddModal(false);
      setNewEndpoint({ name: '', url: '', events: [] });
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string, current: boolean) => {
    const supabase = createClient();
    await supabase.from('webhook_endpoints').update({ is_active: !current }).eq('id', id);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this webhook endpoint?')) return;
    const supabase = createClient();
    await supabase.from('webhook_endpoints').delete().eq('id', id);
    fetchData();
  };

  const handleTest = async (endpoint: WebhookEndpoint) => {
    setTesting(endpoint.id);
    setTestResult(null);
    try {
      const payload = {
        event: 'test.ping',
        timestamp: new Date().toISOString(),
        data: { message: 'Test webhook from Broussard Legal Services', source: 'admin_dashboard' },
      };
      const res = await fetch(endpoint.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Webhook-Secret': endpoint.secret || '' },
        body: JSON.stringify(payload),
      });
      setTestResult({ id: endpoint.id, success: res.ok, message: res.ok ? `Success (${res.status})` : `Failed (${res.status})` });
    } catch (err: unknown) {
      setTestResult({ id: endpoint.id, success: false, message: err instanceof Error ? err.message : 'Network error' });
    } finally {
      setTesting(null);
    }
  };

  const toggleEvent = (eventId: string) => {
    setNewEndpoint(p => ({
      ...p,
      events: p.events.includes(eventId) ? p.events.filter(e => e !== eventId) : [...p.events, eventId],
    }));
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-serif text-2xl text-foreground">Outbound Webhooks</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Push case, invoice, and booking events to Zapier or any external tool</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all hover:opacity-90 flex items-center gap-2" style={{ background: '#355E3B', color: '#fff' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Endpoint
        </button>
      </div>

      {/* Zapier guide */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-blue-700 mb-1">🔗 Zapier Integration Guide</p>
        <p className="text-xs text-blue-600">In Zapier, create a new Zap → Choose "Webhooks by Zapier" as trigger → Select "Catch Hook" → Copy the webhook URL → Paste it below. Events will be sent as JSON POST requests with an <code className="bg-blue-100 px-1 rounded">X-Webhook-Secret</code> header for verification.</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {(['endpoints', 'logs'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-2.5 text-sm font-semibold capitalize border-b-2 transition-all ${activeTab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>{t}</button>
        ))}
      </div>

      {loading ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : activeTab === 'endpoints' ? (
        endpoints.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-muted/40 flex items-center justify-center mx-auto mb-4">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
            </div>
            <p className="text-muted-foreground text-sm">No webhook endpoints yet. Add your first endpoint to start pushing events.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {endpoints.map(ep => (
              <div key={ep.id} className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-2 h-2 rounded-full ${ep.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                      <h3 className="font-semibold text-foreground">{ep.name}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono truncate">{ep.url}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {ep.events.map(e => (
                        <span key={e} className="text-[10px] bg-secondary text-muted-foreground px-2 py-0.5 rounded-full border border-border">{e}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right mr-2">
                      <p className="text-xs text-emerald-600 font-semibold">{ep.success_count} ok</p>
                      <p className="text-xs text-red-500">{ep.failure_count} failed</p>
                    </div>
                    <button onClick={() => handleTest(ep)} disabled={testing === ep.id} className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all disabled:opacity-50">
                      {testing === ep.id ? 'Testing…' : 'Test'}
                    </button>
                    <button onClick={() => handleToggle(ep.id, ep.is_active)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${ep.is_active ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      {ep.is_active ? 'Active' : 'Paused'}
                    </button>
                    <button onClick={() => handleDelete(ep.id)} className="text-muted-foreground/40 hover:text-red-500 transition-colors p-1">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                    </button>
                  </div>
                </div>
                {testResult?.id === ep.id && (
                  <div className={`mt-3 p-2 rounded-lg text-xs font-medium ${testResult.success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                    {testResult.success ? '✓' : '✗'} {testResult.message}
                  </div>
                )}
                {ep.secret && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-xs text-muted-foreground">Secret: <code className="bg-secondary px-1.5 py-0.5 rounded text-foreground font-mono">{ep.secret}</code></p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {logs.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-sm">No webhook logs yet.</div>
          ) : (
            <div className="divide-y divide-border">
              {logs.map(log => (
                <div key={log.id} className="flex items-start justify-between gap-4 px-5 py-3.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${log.status === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      <span className="text-sm font-medium text-foreground">{log.event_type}</span>
                    </div>
                    {log.error_message && <p className="text-xs text-red-600 mt-0.5">{log.error_message}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${log.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{log.response_code || log.status}</span>
                    <p className="text-xs text-muted-foreground mt-1">{fmtDate(log.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-serif text-xl text-foreground">Add Webhook Endpoint</h3>
              <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">Name *</label>
                <input value={newEndpoint.name} onChange={e => setNewEndpoint(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Zapier — New Case" className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">Webhook URL *</label>
                <input value={newEndpoint.url} onChange={e => setNewEndpoint(p => ({ ...p, url: e.target.value }))} placeholder="https://hooks.zapier.com/hooks/catch/…" className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono" />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 block">Events to Subscribe *</label>
                <div className="grid grid-cols-1 gap-2">
                  {AVAILABLE_EVENTS.map(ev => (
                    <label key={ev.id} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${newEndpoint.events.includes(ev.id) ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}>
                      <input type="checkbox" checked={newEndpoint.events.includes(ev.id)} onChange={() => toggleEvent(ev.id)} className="mt-0.5 accent-primary" />
                      <div>
                        <p className="text-sm font-medium text-foreground">{ev.label}</p>
                        <p className="text-xs text-muted-foreground">{ev.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-all">Cancel</button>
              <button onClick={handleAdd} disabled={saving || !newEndpoint.name || !newEndpoint.url || newEndpoint.events.length === 0} className="flex-1 py-2.5 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-50" style={{ background: '#355E3B', color: '#fff' }}>
                {saving ? 'Saving…' : 'Add Endpoint'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
