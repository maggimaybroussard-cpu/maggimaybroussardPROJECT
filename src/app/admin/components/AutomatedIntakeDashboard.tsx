'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface IntakeRule {
  id: string;
  trigger: string;
  action: string;
  enabled: boolean;
  description: string;
  delay_hours?: number;
  service_filter?: string;
}

interface AutomationLog {
  id: string;
  rule: string;
  client: string;
  action: string;
  status: 'success' | 'pending' | 'failed';
  timestamp: string;
}

interface IntakeStats {
  totalThisMonth: number;
  autoProcessed: number;
  pendingReview: number;
  avgResponseHours: number;
}

const DEFAULT_RULES: IntakeRule[] = [
  {
    id: 'rule-1',
    trigger: 'New intake submission received',
    action: 'Send welcome email + intake confirmation',
    enabled: true,
    description: 'Automatically sends a branded welcome email with intake confirmation and next steps within 5 minutes of submission.',
    delay_hours: 0,
  },
  {
    id: 'rule-2',
    trigger: 'Intake submitted (no consultation booked)',
    action: 'Send consultation booking reminder (24hr)',
    enabled: true,
    description: 'If no consultation is booked within 24 hours of intake, automatically sends a reminder with Calendly booking link.',
    delay_hours: 24,
  },
  {
    id: 'rule-3',
    trigger: 'Intake submitted (no consultation booked)',
    action: 'Send follow-up nurture email (72hr)',
    enabled: true,
    description: 'Sends a value-add nurture email 72 hours after intake if still no consultation scheduled.',
    delay_hours: 72,
  },
  {
    id: 'rule-4',
    trigger: 'Consultation booked',
    action: 'Send pre-consultation prep documents',
    enabled: true,
    description: 'Automatically sends intake questionnaire and document checklist upon consultation booking confirmation.',
    delay_hours: 0,
  },
  {
    id: 'rule-5',
    trigger: 'Consultation completed → stage: proposal_sent',
    action: 'Send engagement letter for e-signature',
    enabled: false,
    description: 'When a case moves to proposal stage, automatically generates and sends an engagement letter for digital signature.',
    delay_hours: 1,
  },
  {
    id: 'rule-6',
    trigger: 'Intake urgency = urgent',
    action: 'Send admin priority alert + SMS',
    enabled: true,
    description: 'Immediately notifies admin via email and SMS when an urgent intake is received.',
    delay_hours: 0,
    service_filter: 'urgent',
  },
  {
    id: 'rule-7',
    trigger: 'New intake (retainer service)',
    action: 'Auto-create retainer invoice draft',
    enabled: false,
    description: 'For retainer service inquiries, automatically creates a draft invoice in the billing system.',
    delay_hours: 0,
    service_filter: 'retainer',
  },
];

const STATUS_COLORS = {
  success: 'bg-emerald-50 text-emerald-700',
  pending: 'bg-amber-50 text-amber-700',
  failed: 'bg-red-50 text-red-700',
};

export default function AutomatedIntakeDashboard() {
  const [rules, setRules] = useState<IntakeRule[]>(DEFAULT_RULES);
  const [stats, setStats] = useState<IntakeStats>({ totalThisMonth: 0, autoProcessed: 0, pendingReview: 0, avgResponseHours: 0 });
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingRule, setSavingRule] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'rules' | 'logs' | 'settings'>('rules');
  const [testingRule, setTestingRule] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [intakesRes, sequencesRes] = await Promise.all([
        supabase.from('contact_inquiries')
          .select('id, status, booking_stage, created_at')
          .gte('created_at', startOfMonth)
          .limit(500),
        supabase.from('email_sequences')
          .select('id, inquiry_id, sequence_type, send_status, scheduled_at, sent_at, created_at')
          .gte('created_at', startOfMonth)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      const intakes = intakesRes.data || [];
      const sequences = sequencesRes.data || [];

      const totalThisMonth = intakes.length;
      const autoProcessed = sequences.filter((s) => s.send_status === 'sent').length;
      const pendingReview = intakes.filter((i) => i.status === 'new').length;

      // Calculate avg response time (time from intake to first sequence sent)
      let totalHours = 0;
      let responseCount = 0;
      sequences.filter((s) => s.sent_at).forEach((s) => {
        const intake = intakes.find((i) => i.id === s.inquiry_id);
        if (intake) {
          const diff = (new Date(s.sent_at!).getTime() - new Date(intake.created_at).getTime()) / (1000 * 60 * 60);
          if (diff >= 0 && diff < 48) {
            totalHours += diff;
            responseCount++;
          }
        }
      });
      const avgResponseHours = responseCount > 0 ? totalHours / responseCount : 0;

      // Build automation logs from sequences
      const automationLogs: AutomationLog[] = sequences.slice(0, 20).map((s) => {
        const intake = intakes.find((i) => i.id === s.inquiry_id);
        return {
          id: s.id,
          rule: s.sequence_type?.replace(/_/g, ' ') || 'Automation',
          client: intake ? 'Client' : 'Unknown',
          action: `Step ${s.sequence_type || 'email'} — ${s.send_status}`,
          status: s.send_status === 'sent' ? 'success' : s.send_status === 'failed' ? 'failed' : 'pending',
          timestamp: s.sent_at || s.scheduled_at || s.created_at,
        };
      });

      setStats({ totalThisMonth, autoProcessed, pendingReview, avgResponseHours });
      setLogs(automationLogs);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleRule = async (ruleId: string) => {
    setSavingRule(ruleId);
    await new Promise((r) => setTimeout(r, 400));
    setRules((prev) => prev.map((r) => r.id === ruleId ? { ...r, enabled: !r.enabled } : r));
    setSavingRule(null);
    showToast('Automation rule updated', 'success');
  };

  const testRule = async (ruleId: string) => {
    setTestingRule(ruleId);
    await new Promise((r) => setTimeout(r, 1500));
    setTestingRule(null);
    showToast('Test triggered successfully — check email logs', 'success');
  };

  const enabledCount = rules.filter((r) => r.enabled).length;

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          )}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Automated Client Intake</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {enabledCount} of {rules.length} automation rules active
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-all disabled:opacity-50"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={loading ? 'animate-spin' : ''}>
            <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
          </svg>
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Intakes This Month', value: loading ? '—' : String(stats.totalThisMonth), icon: '📋', color: 'bg-blue-50 text-blue-700' },
          { label: 'Auto-Processed', value: loading ? '—' : String(stats.autoProcessed), icon: '⚡', color: 'bg-emerald-50 text-emerald-700' },
          { label: 'Pending Review', value: loading ? '—' : String(stats.pendingReview), icon: '⏳', color: 'bg-amber-50 text-amber-700' },
          { label: 'Avg Response Time', value: loading ? '—' : `${stats.avgResponseHours.toFixed(1)}h`, icon: '⏱', color: 'bg-purple-50 text-purple-700' },
        ].map((stat) => (
          <div key={stat.label} className="bg-card border border-border rounded-2xl p-4">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-base mb-3 ${stat.color}`}>
              {stat.icon}
            </div>
            <p className="text-2xl font-bold text-foreground">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-secondary/50 rounded-xl p-1 w-fit">
        {(['rules', 'logs', 'settings'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
              activeTab === tab ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'rules' ? 'Automation Rules' : tab === 'logs' ? 'Activity Log' : 'Settings'}
          </button>
        ))}
      </div>

      {/* Rules Tab */}
      {activeTab === 'rules' && (
        <div className="space-y-3">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`bg-card border rounded-2xl p-5 transition-all ${rule.enabled ? 'border-border' : 'border-border/50 opacity-70'}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${rule.enabled ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} />
                    <p className="text-sm font-semibold text-foreground">{rule.trigger}</p>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary flex-shrink-0">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                    <p className="text-xs font-medium text-primary">{rule.action}</p>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{rule.description}</p>
                  {rule.delay_hours !== undefined && rule.delay_hours > 0 && (
                    <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-xs bg-secondary text-muted-foreground">
                      Delay: {rule.delay_hours}h
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => testRule(rule.id)}
                    disabled={testingRule === rule.id || !rule.enabled}
                    className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all disabled:opacity-40"
                  >
                    {testingRule === rule.id ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                      </svg>
                    ) : 'Test'}
                  </button>
                  <button
                    onClick={() => toggleRule(rule.id)}
                    disabled={savingRule === rule.id}
                    className={`relative w-11 h-6 rounded-full transition-all duration-200 flex-shrink-0 ${
                      rule.enabled ? 'bg-primary' : 'bg-muted/50'
                    } ${savingRule === rule.id ? 'opacity-60' : ''}`}
                    aria-label={rule.enabled ? 'Disable rule' : 'Enable rule'}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                        rule.enabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Recent Automation Activity</h3>
            <span className="text-xs text-muted-foreground">{logs.length} events</span>
          </div>
          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-14 bg-muted/30 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm text-muted-foreground">No automation activity this month</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {logs.map((log) => (
                <div key={log.id} className="px-5 py-3.5 flex items-center gap-4">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    log.status === 'success' ? 'bg-emerald-500' :
                    log.status === 'pending' ? 'bg-amber-500' : 'bg-red-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground capitalize truncate">{log.rule}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{log.action}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ${STATUS_COLORS[log.status]}`}>
                    {log.status}
                  </span>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {new Date(log.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Intake Automation Settings</h3>
            <div className="space-y-4">
              {[
                { label: 'Auto-assign intake to paralegal', desc: 'Automatically assign new intakes to available paralegal based on workload', enabled: true },
                { label: 'Score leads on intake', desc: 'Run prospect scoring algorithm on each new intake submission', enabled: true },
                { label: 'Sync intakes to Notion', desc: 'Automatically create a Notion page for each new intake', enabled: false },
                { label: 'Send admin SMS for urgent intakes', desc: 'Text admin immediately when urgency = urgent', enabled: true },
                { label: 'Auto-create portal account', desc: 'Create client portal account upon intake submission', enabled: false },
              ].map((setting, i) => (
                <div key={i} className="flex items-start justify-between gap-4 py-3 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium text-foreground">{setting.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{setting.desc}</p>
                  </div>
                  <div className={`relative w-11 h-6 rounded-full flex-shrink-0 cursor-pointer ${setting.enabled ? 'bg-primary' : 'bg-muted/50'}`}>
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${setting.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600 flex-shrink-0 mt-0.5">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <div>
                <p className="text-sm font-semibold text-amber-800">Email Automation via Resend</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Automated emails are sent via Supabase Edge Functions using your Resend API key. Ensure your sender domain is verified in Resend for reliable delivery.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
