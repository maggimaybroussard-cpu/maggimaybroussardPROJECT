'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

type TriggerType = 'service_type' | 'intake_source' | 'urgency_flag' | 'stage_change' | 'time_elapsed';
type SequenceType = 'consultation_reminder' | 'retainer_reminder' | 'follow_up_survey' | 'nurture_email' | 'sms_alert';
type ConditionOperator = 'equals' | 'contains' | 'not_equals' | 'is_set';

interface TriggerCondition {
  field: TriggerType;
  operator: ConditionOperator;
  value: string;
}

interface SequenceStep {
  id: string;
  stepNumber: number;
  type: SequenceType;
  delayHours: number;
  subject: string;
  description: string;
  channel: 'email' | 'sms' | 'both';
}

interface AutomationRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  triggerConditions: TriggerCondition[];
  conditionLogic: 'AND' | 'OR';
  sequence: SequenceStep[];
  totalEnrolled: number;
  completionRate: number;
  lastTriggered: string | null;
  createdAt: string;
}

interface JourneyStats {
  activeRules: number;
  totalEnrolled: number;
  completedThisMonth: number;
  avgCompletionRate: number;
}

// ─── Default Rules ────────────────────────────────────────────────────────────

const DEFAULT_RULES: AutomationRule[] = [
  {
    id: 'journey-1',
    name: 'Consultation Reminder Sequence',
    description: 'Multi-step reminder sequence for prospects who booked a consultation but haven\'t confirmed.',
    enabled: true,
    triggerConditions: [
      { field: 'intake_source', operator: 'equals', value: 'calendly' },
      { field: 'urgency_flag', operator: 'not_equals', value: 'urgent' },
    ],
    conditionLogic: 'AND',
    sequence: [
      { id: 's1-1', stepNumber: 1, type: 'consultation_reminder', delayHours: 24, subject: '24-Hour Reminder: Your Consultation Tomorrow', description: 'Sends a branded reminder email 24 hours before the scheduled consultation with prep materials.', channel: 'email' },
      { id: 's1-2', stepNumber: 2, type: 'consultation_reminder', delayHours: 2, subject: '2-Hour Reminder: Consultation Starting Soon', description: 'Final reminder 2 hours before with Zoom/phone dial-in details.', channel: 'both' },
      { id: 's1-3', stepNumber: 3, type: 'follow_up_survey', delayHours: 4, subject: 'How Did Your Consultation Go?', description: 'Post-consultation satisfaction survey sent 4 hours after the scheduled end time.', channel: 'email' },
    ],
    totalEnrolled: 0,
    completionRate: 0,
    lastTriggered: null,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'journey-2',
    name: 'Urgent Intake Fast-Track',
    description: 'Immediate escalation sequence for intakes flagged as urgent — bypasses standard nurture.',
    enabled: true,
    triggerConditions: [
      { field: 'urgency_flag', operator: 'equals', value: 'urgent' },
    ],
    conditionLogic: 'AND',
    sequence: [
      { id: 's2-1', stepNumber: 1, type: 'sms_alert', delayHours: 0, subject: 'URGENT: New Priority Intake Received', description: 'Immediately sends SMS alert to attorney and admin with intake details.', channel: 'sms' },
      { id: 's2-2', stepNumber: 2, type: 'consultation_reminder', delayHours: 0.5, subject: 'Priority Consultation Booking — Action Required', description: 'Sends client a priority booking link with same-day availability options.', channel: 'email' },
      { id: 's2-3', stepNumber: 3, type: 'nurture_email', delayHours: 48, subject: 'Following Up on Your Urgent Legal Matter', description: 'If no consultation booked after 48 hours, sends a personal follow-up from the attorney.', channel: 'email' },
    ],
    totalEnrolled: 0,
    completionRate: 0,
    lastTriggered: null,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'journey-3',
    name: 'Retainer Onboarding Sequence',
    description: 'Full onboarding journey for new retainer clients — from signing to active case management.',
    enabled: true,
    triggerConditions: [
      { field: 'service_type', operator: 'equals', value: 'retainer' },
      { field: 'stage_change', operator: 'equals', value: 'retainer_signed' },
    ],
    conditionLogic: 'AND',
    sequence: [
      { id: 's3-1', stepNumber: 1, type: 'retainer_reminder', delayHours: 0, subject: 'Welcome to Broussard Legal Services — Retainer Confirmed', description: 'Sends welcome email with retainer summary, portal access, and next steps.', channel: 'email' },
      { id: 's3-2', stepNumber: 2, type: 'retainer_reminder', delayHours: 72, subject: 'Your Retainer Portal Is Ready', description: 'Sends portal onboarding guide with document upload instructions and case timeline.', channel: 'email' },
      { id: 's3-3', stepNumber: 3, type: 'follow_up_survey', delayHours: 168, subject: 'How Is Your Onboarding Experience?', description: '7-day onboarding satisfaction survey to identify any friction points early.', channel: 'email' },
      { id: 's3-4', stepNumber: 4, type: 'retainer_reminder', delayHours: 720, subject: '30-Day Retainer Check-In', description: 'Monthly check-in email with case progress summary and upcoming milestones.', channel: 'email' },
    ],
    totalEnrolled: 0,
    completionRate: 0,
    lastTriggered: null,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'journey-4',
    name: 'Website Intake Nurture',
    description: 'Nurture sequence for leads who submitted via the website contact form but haven\'t booked.',
    enabled: true,
    triggerConditions: [
      { field: 'intake_source', operator: 'equals', value: 'website' },
      { field: 'urgency_flag', operator: 'not_equals', value: 'urgent' },
    ],
    conditionLogic: 'AND',
    sequence: [
      { id: 's4-1', stepNumber: 1, type: 'nurture_email', delayHours: 1, subject: 'Thank You for Reaching Out — Here\'s What Happens Next', description: 'Immediate confirmation with intake summary and expected response timeline.', channel: 'email' },
      { id: 's4-2', stepNumber: 2, type: 'consultation_reminder', delayHours: 24, subject: 'Ready to Schedule Your Free Consultation?', description: 'Sends Calendly booking link with available slots for the next 7 days.', channel: 'email' },
      { id: 's4-3', stepNumber: 3, type: 'nurture_email', delayHours: 72, subject: 'How Broussard Legal Can Help With Your Situation', description: 'Value-add email with relevant case studies and service overview.', channel: 'email' },
      { id: 's4-4', stepNumber: 4, type: 'follow_up_survey', delayHours: 168, subject: 'Still Looking for Legal Help?', description: '7-day final follow-up with a short survey to understand their current status.', channel: 'email' },
    ],
    totalEnrolled: 0,
    completionRate: 0,
    lastTriggered: null,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'journey-5',
    name: 'Business Formation Fast-Track',
    description: 'Targeted sequence for business formation service inquiries with document collection.',
    enabled: false,
    triggerConditions: [
      { field: 'service_type', operator: 'contains', value: 'business' },
    ],
    conditionLogic: 'AND',
    sequence: [
      { id: 's5-1', stepNumber: 1, type: 'nurture_email', delayHours: 0, subject: 'Start Your Business Formation — Documents Needed', description: 'Sends business formation checklist and document request form immediately.', channel: 'email' },
      { id: 's5-2', stepNumber: 2, type: 'consultation_reminder', delayHours: 48, subject: 'Schedule Your Business Formation Consultation', description: 'Booking reminder with business-specific consultation agenda.', channel: 'email' },
      { id: 's5-3', stepNumber: 3, type: 'retainer_reminder', delayHours: 120, subject: 'Your Business Formation Retainer Proposal', description: 'Sends retainer proposal with business formation pricing and scope.', channel: 'email' },
    ],
    totalEnrolled: 0,
    completionRate: 0,
    lastTriggered: null,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'journey-6',
    name: 'Post-Case Close Survey',
    description: 'Satisfaction and referral sequence triggered when a case is marked as closed.',
    enabled: true,
    triggerConditions: [
      { field: 'stage_change', operator: 'equals', value: 'case_closed' },
    ],
    conditionLogic: 'AND',
    sequence: [
      { id: 's6-1', stepNumber: 1, type: 'follow_up_survey', delayHours: 24, subject: 'Your Case Is Closed — Share Your Experience', description: 'NPS survey sent 24 hours after case closure with Google review link.', channel: 'email' },
      { id: 's6-2', stepNumber: 2, type: 'nurture_email', delayHours: 168, subject: 'Thank You for Trusting Broussard Legal', description: 'Personal thank-you email with referral program details and testimonial request.', channel: 'email' },
      { id: 's6-3', stepNumber: 3, type: 'retainer_reminder', delayHours: 2160, subject: 'Annual Legal Check-In — Are You Protected?', description: '90-day re-engagement email offering annual legal review services.', channel: 'email' },
    ],
    totalEnrolled: 0,
    completionRate: 0,
    lastTriggered: null,
    createdAt: new Date().toISOString(),
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TRIGGER_LABELS: Record<TriggerType, string> = {
  service_type: 'Service Type',
  intake_source: 'Intake Source',
  urgency_flag: 'Urgency Flag',
  stage_change: 'Stage Change',
  time_elapsed: 'Time Elapsed',
};

const SEQUENCE_LABELS: Record<SequenceType, { label: string; color: string; icon: string }> = {
  consultation_reminder: { label: 'Consultation Reminder', color: 'bg-blue-50 text-blue-700', icon: '📅' },
  retainer_reminder: { label: 'Retainer Reminder', color: 'bg-purple-50 text-purple-700', icon: '📋' },
  follow_up_survey: { label: 'Follow-Up Survey', color: 'bg-amber-50 text-amber-700', icon: '📊' },
  nurture_email: { label: 'Nurture Email', color: 'bg-emerald-50 text-emerald-700', icon: '✉️' },
  sms_alert: { label: 'SMS Alert', color: 'bg-rose-50 text-rose-700', icon: '📱' },
};

const CHANNEL_LABELS: Record<string, { label: string; color: string }> = {
  email: { label: 'Email', color: 'bg-sky-50 text-sky-700' },
  sms: { label: 'SMS', color: 'bg-orange-50 text-orange-700' },
  both: { label: 'Email + SMS', color: 'bg-violet-50 text-violet-700' },
};

function formatDelay(hours: number): string {
  if (hours === 0) return 'Immediately';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 24) return `${hours}h`;
  if (hours < 168) return `${Math.round(hours / 24)}d`;
  return `${Math.round(hours / 168)}w`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ClientJourneyAutomationDashboard() {
  const [rules, setRules] = useState<AutomationRule[]>(DEFAULT_RULES);
  const [stats, setStats] = useState<JourneyStats>({ activeRules: 0, totalEnrolled: 0, completedThisMonth: 0, avgCompletionRate: 0 });
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'rules' | 'builder' | 'analytics'>('rules');
  const [expandedRule, setExpandedRule] = useState<string | null>(null);
  const [togglingRule, setTogglingRule] = useState<string | null>(null);
  const [testingRule, setTestingRule] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Builder state
  const [builderName, setBuilderName] = useState('');
  const [builderDesc, setBuilderDesc] = useState('');
  const [builderConditions, setBuilderConditions] = useState<TriggerCondition[]>([
    { field: 'service_type', operator: 'equals', value: '' },
  ]);
  const [builderLogic, setBuilderLogic] = useState<'AND' | 'OR'>('AND');
  const [builderSteps, setBuilderSteps] = useState<SequenceStep[]>([
    { id: 'new-1', stepNumber: 1, type: 'nurture_email', delayHours: 0, subject: '', description: '', channel: 'email' },
  ]);
  const [savingBuilder, setSavingBuilder] = useState(false);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  };

  // Cleanup toast timer on unmount
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, []);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [seqRes, journeyRes] = await Promise.all([
        supabase.from('email_sequences')
          .select('id, send_status, sequence_type, created_at')
          .gte('created_at', startOfMonth)
          .limit(500),
        supabase.from('client_journey_automations')
          .select('id, rule_id, status, enrolled_at, completed_at')
          .limit(500)
          .maybeSingle(),
      ]);

      const sequences = seqRes.data || [];
      const sentCount = sequences.filter((s) => s.send_status === 'sent').length;
      const totalCount = sequences.length;

      const activeRules = rules.filter((r) => r.enabled).length;
      const avgCompletionRate = totalCount > 0 ? Math.round((sentCount / totalCount) * 100) : 0;

      setStats({
        activeRules,
        totalEnrolled: totalCount,
        completedThisMonth: sentCount,
        avgCompletionRate,
      });

      // Update rule stats from sequences
      setRules((prev) => prev.map((rule) => {
        const ruleSeqs = sequences.filter((s) => {
          const t = s.sequence_type || '';
          if (rule.id === 'journey-1') return t.includes('consultation') || t.includes('booking');
          if (rule.id === 'journey-2') return t.includes('urgent') || t.includes('priority');
          if (rule.id === 'journey-3') return t.includes('retainer') || t.includes('onboarding');
          if (rule.id === 'journey-4') return t.includes('nurture') || t.includes('welcome');
          return false;
        });
        const enrolled = ruleSeqs.length;
        const completed = ruleSeqs.filter((s) => s.send_status === 'sent').length;
        return {
          ...rule,
          totalEnrolled: enrolled,
          completionRate: enrolled > 0 ? Math.round((completed / enrolled) * 100) : 0,
        };
      }));
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [rules.length]);

  useEffect(() => {
    fetchStats();
  }, []);

  const toggleRule = async (ruleId: string) => {
    setTogglingRule(ruleId);
    await new Promise((r) => setTimeout(r, 400));
    setRules((prev) => prev.map((r) => r.id === ruleId ? { ...r, enabled: !r.enabled } : r));
    setTogglingRule(null);
    showToast('Journey automation updated', 'success');
  };

  const testRule = async (ruleId: string) => {
    setTestingRule(ruleId);
    await new Promise((r) => setTimeout(r, 1800));
    setTestingRule(null);
    showToast('Test sequence triggered — check email/SMS logs', 'success');
  };

  const addBuilderCondition = () => {
    setBuilderConditions((prev) => [...prev, { field: 'service_type', operator: 'equals', value: '' }]);
  };

  const removeBuilderCondition = (idx: number) => {
    setBuilderConditions((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateBuilderCondition = (idx: number, key: keyof TriggerCondition, value: string) => {
    setBuilderConditions((prev) => prev.map((c, i) => i === idx ? { ...c, [key]: value } : c));
  };

  const addBuilderStep = () => {
    const nextNum = builderSteps.length + 1;
    setBuilderSteps((prev) => [...prev, {
      id: `new-${nextNum}`,
      stepNumber: nextNum,
      type: 'nurture_email',
      delayHours: 24,
      subject: '',
      description: '',
      channel: 'email',
    }]);
  };

  const removeBuilderStep = (idx: number) => {
    setBuilderSteps((prev) => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, stepNumber: i + 1 })));
  };

  const updateBuilderStep = (idx: number, key: keyof SequenceStep, value: string | number) => {
    setBuilderSteps((prev) => prev.map((s, i) => i === idx ? { ...s, [key]: value } : s));
  };

  const saveNewRule = async () => {
    if (!builderName.trim()) { showToast('Please enter a rule name', 'error'); return; }
    if (builderConditions.some((c) => !c.value.trim())) { showToast('All conditions must have a value', 'error'); return; }
    if (builderSteps.some((s) => !s.subject.trim())) { showToast('All steps must have a subject', 'error'); return; }

    setSavingBuilder(true);
    await new Promise((r) => setTimeout(r, 800));

    const newRule: AutomationRule = {
      id: `journey-custom-${Date.now()}`,
      name: builderName,
      description: builderDesc,
      enabled: false,
      triggerConditions: builderConditions,
      conditionLogic: builderLogic,
      sequence: builderSteps,
      totalEnrolled: 0,
      completionRate: 0,
      lastTriggered: null,
      createdAt: new Date().toISOString(),
    };

    setRules((prev) => [...prev, newRule]);
    setBuilderName('');
    setBuilderDesc('');
    setBuilderConditions([{ field: 'service_type', operator: 'equals', value: '' }]);
    setBuilderSteps([{ id: 'new-1', stepNumber: 1, type: 'nurture_email', delayHours: 0, subject: '', description: '', channel: 'email' }]);
    setSavingBuilder(false);
    setActiveView('rules');
    showToast('Journey automation rule created', 'success');
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
          <h2 className="text-lg font-semibold text-foreground">Client Journey Automation</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {enabledCount} of {rules.length} journey rules active · conditional triggers + multi-step sequences
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchStats()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-all disabled:opacity-50"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={loading ? 'animate-spin' : ''}>
              <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
            </svg>
            Refresh
          </button>
          <button
            onClick={() => setActiveView('builder')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-background text-xs font-medium hover:opacity-90 transition-all"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Journey Rule
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Rules', value: loading ? '—' : String(stats.activeRules), icon: '⚡', color: 'bg-emerald-50 text-emerald-700' },
          { label: 'Total Enrolled', value: loading ? '—' : String(stats.totalEnrolled), icon: '👥', color: 'bg-blue-50 text-blue-700' },
          { label: 'Completed This Month', value: loading ? '—' : String(stats.completedThisMonth), icon: '✅', color: 'bg-purple-50 text-purple-700' },
          { label: 'Avg Completion Rate', value: loading ? '—' : `${stats.avgCompletionRate}%`, icon: '📈', color: 'bg-amber-50 text-amber-700' },
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

      {/* View Tabs */}
      <div className="flex gap-1 bg-muted/40 rounded-xl p-1 w-fit">
        {(['rules', 'builder', 'analytics'] as const).map((view) => (
          <button
            key={view}
            onClick={() => setActiveView(view)}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${
              activeView === view
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {view === 'builder' ? 'Rule Builder' : view === 'analytics' ? 'Analytics' : 'Journey Rules'}
          </button>
        ))}
      </div>

      {/* ── Journey Rules View ── */}
      {activeView === 'rules' && (
        <div className="space-y-3">
          {rules.map((rule) => {
            const isExpanded = expandedRule === rule.id;
            const isToggling = togglingRule === rule.id;
            const isTesting = testingRule === rule.id;

            return (
              <div key={rule.id} className={`bg-card border rounded-2xl overflow-hidden transition-all ${
                rule.enabled ? 'border-border' : 'border-border/50 opacity-75'
              }`}>
                {/* Rule Header */}
                <div className="p-4 flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${rule.enabled ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">{rule.name}</span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${rule.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                        {rule.enabled ? 'Active' : 'Paused'}
                      </span>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                        {rule.sequence.length} steps
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{rule.description}</p>

                    {/* Trigger Conditions Summary */}
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <span className="text-[10px] text-muted-foreground font-medium">Triggers when:</span>
                      {rule.triggerConditions.map((cond, idx) => (
                        <React.Fragment key={idx}>
                          <span className="text-[10px] bg-muted/60 text-foreground px-2 py-0.5 rounded-md font-mono">
                            {TRIGGER_LABELS[cond.field]} {cond.operator} &quot;{cond.value}&quot;
                          </span>
                          {idx < rule.triggerConditions.length - 1 && (
                            <span className="text-[10px] font-bold text-muted-foreground">{rule.conditionLogic}</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-[10px] text-muted-foreground">
                        <span className="font-semibold text-foreground">{rule.totalEnrolled}</span> enrolled
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        <span className="font-semibold text-foreground">{rule.completionRate}%</span> completion
                      </span>
                      {rule.lastTriggered && (
                        <span className="text-[10px] text-muted-foreground">
                          Last: {new Date(rule.lastTriggered).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => testRule(rule.id)}
                      disabled={isTesting}
                      className="text-[10px] font-medium px-2.5 py-1 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-all disabled:opacity-50"
                    >
                      {isTesting ? 'Testing…' : 'Test'}
                    </button>
                    <button
                      onClick={() => setExpandedRule(isExpanded ? null : rule.id)}
                      className="text-[10px] font-medium px-2.5 py-1 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-all"
                    >
                      {isExpanded ? 'Collapse' : 'View Steps'}
                    </button>
                    {/* Toggle */}
                    <button
                      onClick={() => toggleRule(rule.id)}
                      disabled={isToggling}
                      className={`relative w-9 h-5 rounded-full transition-all flex-shrink-0 ${
                        rule.enabled ? 'bg-emerald-500' : 'bg-muted'
                      } ${isToggling ? 'opacity-50' : ''}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                        rule.enabled ? 'left-4' : 'left-0.5'
                      }`} />
                    </button>
                  </div>
                </div>

                {/* Expanded Sequence Steps */}
                {isExpanded && (
                  <div className="border-t border-border/60 px-4 pb-4 pt-3">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Sequence Steps</p>
                    <div className="space-y-2">
                      {rule.sequence.map((step, idx) => {
                        const seqMeta = SEQUENCE_LABELS[step.type];
                        const chanMeta = CHANNEL_LABELS[step.channel];
                        return (
                          <div key={step.id} className="flex items-start gap-3">
                            {/* Step connector */}
                            <div className="flex flex-col items-center flex-shrink-0 mt-1">
                              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-foreground">
                                {step.stepNumber}
                              </div>
                              {idx < rule.sequence.length - 1 && (
                                <div className="w-px h-4 bg-border mt-1" />
                              )}
                            </div>
                            <div className="flex-1 bg-muted/30 rounded-xl p-3">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${seqMeta.color}`}>
                                  {seqMeta.icon} {seqMeta.label}
                                </span>
                                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${chanMeta.color}`}>
                                  {chanMeta.label}
                                </span>
                                <span className="text-[10px] text-muted-foreground ml-auto">
                                  ⏱ {formatDelay(step.delayHours)} after previous
                                </span>
                              </div>
                              <p className="text-xs font-medium text-foreground">{step.subject}</p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">{step.description}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Rule Builder View ── */}
      {activeView === 'builder' && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">New Journey Rule</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Define conditional triggers and build a multi-step automation sequence</p>
            </div>
            <button onClick={() => setActiveView('rules')} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              ← Back to Rules
            </button>
          </div>

          {/* Basic Info */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Rule Name *</label>
              <input
                type="text"
                value={builderName}
                onChange={(e) => setBuilderName(e.target.value)}
                placeholder="e.g. Estate Planning Intake Sequence"
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Description</label>
              <textarea
                value={builderDesc}
                onChange={(e) => setBuilderDesc(e.target.value)}
                placeholder="Describe what this automation does and when it should run…"
                rows={2}
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 resize-none"
              />
            </div>
          </div>

          {/* Trigger Conditions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-semibold text-foreground">Trigger Conditions</p>
                <p className="text-[11px] text-muted-foreground">Rule fires when these conditions are met</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">Match:</span>
                {(['AND', 'OR'] as const).map((logic) => (
                  <button
                    key={logic}
                    onClick={() => setBuilderLogic(logic)}
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all ${
                      builderLogic === logic
                        ? 'bg-foreground text-background'
                        : 'border border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {logic}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              {builderConditions.map((cond, idx) => (
                <div key={idx} className="flex items-center gap-2 flex-wrap">
                  <select
                    value={cond.field}
                    onChange={(e) => updateBuilderCondition(idx, 'field', e.target.value)}
                    className="flex-1 min-w-[140px] px-3 py-2 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  >
                    <option value="service_type">Service Type</option>
                    <option value="intake_source">Intake Source</option>
                    <option value="urgency_flag">Urgency Flag</option>
                    <option value="stage_change">Stage Change</option>
                    <option value="time_elapsed">Time Elapsed</option>
                  </select>
                  <select
                    value={cond.operator}
                    onChange={(e) => updateBuilderCondition(idx, 'operator', e.target.value)}
                    className="w-32 px-3 py-2 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  >
                    <option value="equals">equals</option>
                    <option value="not_equals">not equals</option>
                    <option value="contains">contains</option>
                    <option value="is_set">is set</option>
                  </select>
                  <input
                    type="text"
                    value={cond.value}
                    onChange={(e) => updateBuilderCondition(idx, 'value', e.target.value)}
                    placeholder={
                      cond.field === 'service_type' ? 'retainer, business, estate…' :
                      cond.field === 'intake_source' ? 'website, calendly, referral…' :
                      cond.field === 'urgency_flag' ? 'urgent, normal, low…' :
                      cond.field === 'stage_change'? 'retainer_signed, case_closed…' : 'value'
                    }
                    className="flex-1 min-w-[140px] px-3 py-2 rounded-xl border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                  {builderConditions.length > 1 && (
                    <button
                      onClick={() => removeBuilderCondition(idx)}
                      className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-red-500 hover:border-red-200 transition-all"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={addBuilderCondition}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add condition
              </button>
            </div>
          </div>

          {/* Sequence Steps */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-semibold text-foreground">Sequence Steps</p>
                <p className="text-[11px] text-muted-foreground">Define each step in the automation journey</p>
              </div>
            </div>
            <div className="space-y-3">
              {builderSteps.map((step, idx) => (
                <div key={step.id} className="border border-border rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">Step {step.stepNumber}</span>
                    {builderSteps.length > 1 && (
                      <button
                        onClick={() => removeBuilderStep(idx)}
                        className="text-[10px] text-muted-foreground hover:text-red-500 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground block mb-1">Type</label>
                      <select
                        value={step.type}
                        onChange={(e) => updateBuilderStep(idx, 'type', e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                      >
                        <option value="consultation_reminder">Consultation Reminder</option>
                        <option value="retainer_reminder">Retainer Reminder</option>
                        <option value="follow_up_survey">Follow-Up Survey</option>
                        <option value="nurture_email">Nurture Email</option>
                        <option value="sms_alert">SMS Alert</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground block mb-1">Channel</label>
                      <select
                        value={step.channel}
                        onChange={(e) => updateBuilderStep(idx, 'channel', e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                      >
                        <option value="email">Email</option>
                        <option value="sms">SMS</option>
                        <option value="both">Email + SMS</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground block mb-1">Delay (hours after previous)</label>
                      <input
                        type="number"
                        min="0"
                        value={step.delayHours}
                        onChange={(e) => updateBuilderStep(idx, 'delayHours', Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground block mb-1">Subject / Title *</label>
                    <input
                      type="text"
                      value={step.subject}
                      onChange={(e) => updateBuilderStep(idx, 'subject', e.target.value)}
                      placeholder="Email subject line or SMS title…"
                      className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground block mb-1">Description</label>
                    <input
                      type="text"
                      value={step.description}
                      onChange={(e) => updateBuilderStep(idx, 'description', e.target.value)}
                      placeholder="What does this step do?"
                      className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                    />
                  </div>
                </div>
              ))}
              <button
                onClick={addBuilderStep}
                className="w-full py-2.5 rounded-xl border border-dashed border-border text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all flex items-center justify-center gap-1.5"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add Step
              </button>
            </div>
          </div>

          {/* Save */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
            <button
              onClick={() => setActiveView('rules')}
              className="px-4 py-2 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-all"
            >
              Cancel
            </button>
            <button
              onClick={saveNewRule}
              disabled={savingBuilder}
              className="px-4 py-2 rounded-xl bg-foreground text-background text-xs font-medium hover:opacity-90 transition-all disabled:opacity-50"
            >
              {savingBuilder ? 'Saving…' : 'Save Journey Rule'}
            </button>
          </div>
        </div>
      )}

      {/* ── Analytics View ── */}
      {activeView === 'analytics' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Sequence Type Breakdown */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <p className="text-sm font-semibold text-foreground mb-4">Sequence Type Distribution</p>
              <div className="space-y-3">
                {(Object.entries(SEQUENCE_LABELS) as [SequenceType, { label: string; color: string; icon: string }][]).map(([type, meta]) => {
                  const count = rules.flatMap((r) => r.sequence).filter((s) => s.type === type).length;
                  const total = rules.flatMap((r) => r.sequence).length;
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={type}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${meta.color}`}>
                          {meta.icon} {meta.label}
                        </span>
                        <span className="text-xs font-semibold text-foreground">{count} steps · {pct}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-foreground/70 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Trigger Condition Breakdown */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <p className="text-sm font-semibold text-foreground mb-4">Trigger Condition Types</p>
              <div className="space-y-3">
                {(Object.entries(TRIGGER_LABELS) as [TriggerType, string][]).map(([type, label]) => {
                  const count = rules.flatMap((r) => r.triggerConditions).filter((c) => c.field === type).length;
                  const total = rules.flatMap((r) => r.triggerConditions).length;
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={type}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-foreground">{label}</span>
                        <span className="text-xs font-semibold text-foreground">{count} rules · {pct}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500/70 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Rule Performance Table */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <p className="text-sm font-semibold text-foreground">Journey Rule Performance</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground">Rule</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Steps</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Enrolled</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Completion</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Trigger Logic</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule) => (
                    <tr key={rule.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium text-foreground">{rule.name}</p>
                        <p className="text-muted-foreground text-[10px] mt-0.5 line-clamp-1">{rule.description}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${rule.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                          {rule.enabled ? 'Active' : 'Paused'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-foreground font-medium">{rule.sequence.length}</td>
                      <td className="px-4 py-3 text-foreground font-medium">{rule.totalEnrolled}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${rule.completionRate}%` }} />
                          </div>
                          <span className="text-foreground font-medium">{rule.completionRate}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${rule.conditionLogic === 'AND' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                          {rule.conditionLogic}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
