'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { useChat } from '@/lib/hooks/useChat';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Matter {
  id: string;
  name: string;
  email: string;
  service: string;
  status: string;
}

interface TimeEntry {
  id: string;
  inquiry_id: string | null;
  hours: number;
  description: string | null;
  work_date: string;
  logged_by: string | null;
  assigned_to: string | null;
  billable: boolean;
  task_category: string;
  hourly_rate: number | null;
  created_at: string;
}

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  title: string;
  hourly_rate: number | null;
}

interface StaffMetric {
  name: string;
  billableHours: number;
  writeOffHours: number;
  totalHours: number;
  billableAmount: number;
  writeOffAmount: number;
  utilizationRate: number;
  revenueContribution: number;
  revenueShare: number;
}

interface MatterSummary {
  matterId: string;
  matterName: string;
  billableHours: number;
  writeOffHours: number;
  totalHours: number;
  billableAmount: number;
  writeOffAmount: number;
  writeOffRate: number;
  entries: TimeEntry[];
  staffMetrics: StaffMetric[];
}

interface IntakeSubmission {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  case_type: string;
  case_description: string;
  opposing_party: string | null;
  urgency: string;
  additional_notes: string | null;
  submitted_at: string;
}

interface MatterOutcome {
  id: string;
  inquiry_id: string;
  outcome: string;
  case_type: string;
  close_date: string;
  settlement_amount: number | null;
  notes: string | null;
  marketing_highlight: boolean;
  expertise_tags: string[];
  created_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TASK_CATEGORIES = [
  { value: 'drafting', label: 'Drafting' },
  { value: 'research', label: 'Legal Research' },
  { value: 'client_communication', label: 'Client Communication' },
  { value: 'court_appearance', label: 'Court Appearance' },
  { value: 'review', label: 'Document Review' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'administrative', label: 'Administrative' },
  { value: 'deposition', label: 'Deposition' },
  { value: 'discovery', label: 'Discovery' },
  { value: 'other', label: 'Other' },
];

const CATEGORY_COLORS: Record<string, string> = {
  drafting: 'bg-blue-100 text-blue-700',
  research: 'bg-purple-100 text-purple-700',
  client_communication: 'bg-green-100 text-green-700',
  court_appearance: 'bg-red-100 text-red-700',
  review: 'bg-amber-100 text-amber-700',
  negotiation: 'bg-indigo-100 text-indigo-700',
  administrative: 'bg-gray-100 text-gray-600',
  deposition: 'bg-orange-100 text-orange-700',
  discovery: 'bg-teal-100 text-teal-700',
  other: 'bg-slate-100 text-slate-600',
};

const STAFF_COLORS = ['#355E3B', '#4a7c59', '#6b9e7a', '#8dbf9a', '#afd9ba', '#d4edda'];

const OUTCOME_OPTIONS = [
  { value: 'won', label: 'Won', color: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  { value: 'settled', label: 'Settled', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  { value: 'favorable_judgment', label: 'Favorable Judgment', color: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-500' },
  { value: 'dismissed', label: 'Dismissed', color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  { value: 'lost', label: 'Lost', color: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  { value: 'withdrawn', label: 'Withdrawn', color: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' },
  { value: 'pending_close', label: 'Pending Close', color: 'bg-purple-100 text-purple-700', dot: 'bg-purple-400' },
];

const OUTCOME_CHART_COLORS: Record<string, string> = {
  won: '#16a34a',
  settled: '#2563eb',
  favorable_judgment: '#4f46e5',
  dismissed: '#d97706',
  lost: '#dc2626',
  withdrawn: '#6b7280',
  pending_close: '#9333ea',
};

const FAVORABLE_OUTCOMES = new Set(['won', 'settled', 'favorable_judgment', 'dismissed']);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function fmtHours(h: number) {
  return `${h.toFixed(1)}h`;
}

function buildStaffMetrics(entries: TimeEntry[], totalBillableAmount: number): StaffMetric[] {
  const map = new Map<string, StaffMetric>();

  for (const e of entries) {
    const key = e.assigned_to || e.logged_by || 'Unassigned';
    if (!map.has(key)) {
      map.set(key, {
        name: key,
        billableHours: 0,
        writeOffHours: 0,
        totalHours: 0,
        billableAmount: 0,
        writeOffAmount: 0,
        utilizationRate: 0,
        revenueContribution: 0,
        revenueShare: 0,
      });
    }
    const s = map.get(key)!;
    const hours = Number(e.hours) || 0;
    const rate = Number(e.hourly_rate) || 0;
    const amount = hours * rate;
    s.totalHours += hours;
    if (e.billable !== false) {
      s.billableHours += hours;
      s.billableAmount += amount;
      s.revenueContribution += amount;
    } else {
      s.writeOffHours += hours;
      s.writeOffAmount += amount;
    }
  }

  for (const s of map.values()) {
    s.utilizationRate = s.totalHours > 0 ? (s.billableHours / s.totalHours) * 100 : 0;
    s.revenueShare = totalBillableAmount > 0 ? (s.revenueContribution / totalBillableAmount) * 100 : 0;
  }

  return [...map.values()].sort((a, b) => b.billableHours - a.billableHours);
}

function getOutcomeMeta(outcome: string) {
  return OUTCOME_OPTIONS.find(o => o.value === outcome) || { label: outcome, color: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MatterTimeLogger() {
  const supabase = createClient();

  // Matters list
  const [matters, setMatters] = useState<Matter[]>([]);
  const [selectedMatterId, setSelectedMatterId] = useState<string>('');
  const [matterSummary, setMatterSummary] = useState<MatterSummary | null>(null);

  // Team members
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  // Intake data for selected matter
  const [intakeData, setIntakeData] = useState<IntakeSubmission | null>(null);

  // Active tab
  const [activeTab, setActiveTab] = useState<'log' | 'staff' | 'summary' | 'outcomes'>('log');

  // AI summary state
  const [aiSummaryText, setAiSummaryText] = useState<string>('');
  const [summaryGenerated, setSummaryGenerated] = useState(false);
  const { response: aiResponse, isLoading: aiLoading, error: aiError, sendMessage } = useChat('OPEN_AI', 'gpt-4o-mini', true);

  // Form state
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formHours, setFormHours] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState('drafting');
  const [formBillable, setFormBillable] = useState(true);
  const [formRate, setFormRate] = useState('250');
  const [formLoggedBy, setFormLoggedBy] = useState('Admin');
  const [formAssignedTo, setFormAssignedTo] = useState('');

  // Outcomes state
  const [outcomes, setOutcomes] = useState<MatterOutcome[]>([]);
  const [allOutcomes, setAllOutcomes] = useState<MatterOutcome[]>([]);
  const [outcomesLoading, setOutcomesLoading] = useState(false);
  const [outcomeForm, setOutcomeForm] = useState({
    outcome: 'won',
    case_type: '',
    close_date: new Date().toISOString().split('T')[0],
    settlement_amount: '',
    notes: '',
    marketing_highlight: false,
    expertise_tags: '',
  });
  const [savingOutcome, setSavingOutcome] = useState(false);
  const [deletingOutcomeId, setDeletingOutcomeId] = useState<string | null>(null);
  const [outcomeError, setOutcomeError] = useState<string | null>(null);
  const [outcomeSuccess, setOutcomeSuccess] = useState<string | null>(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filterBillable, setFilterBillable] = useState<'all' | 'billable' | 'writeoff'>('all');

  // Show AI errors as toast
  useEffect(() => {
    if (aiError) toast.error(aiError.message);
  }, [aiError]);

  // Capture streaming AI response
  useEffect(() => {
    if (aiResponse) {
      setAiSummaryText(aiResponse);
      if (!aiLoading) setSummaryGenerated(true);
    }
  }, [aiResponse, aiLoading]);

  // Reset summary when matter changes
  useEffect(() => {
    setAiSummaryText('');
    setSummaryGenerated(false);
  }, [selectedMatterId]);

  // Load matters + team members + all outcomes
  useEffect(() => {
    async function loadInitial() {
      const [mattersRes, teamRes, allOutcomesRes] = await Promise.all([
        supabase
          .from('contact_inquiries')
          .select('id, name, email, service, status')
          .order('created_at', { ascending: false }),
        supabase
          .from('paralegal_profiles')
          .select('id, full_name, email, title, hourly_rate')
          .eq('status', 'active')
          .order('full_name', { ascending: true }),
        supabase
          .from('matter_outcomes')
          .select('id, inquiry_id, outcome, case_type, close_date, settlement_amount, notes, marketing_highlight, expertise_tags, created_at')
          .order('close_date', { ascending: false }),
      ]);
      if (!mattersRes.error && mattersRes.data) setMatters(mattersRes.data as Matter[]);
      if (!teamRes.error && teamRes.data) setTeamMembers(teamRes.data as TeamMember[]);
      if (!allOutcomesRes.error && allOutcomesRes.data) setAllOutcomes(allOutcomesRes.data as MatterOutcome[]);
    }
    loadInitial();
  }, []);

  // Load outcomes for selected matter
  const loadOutcomes = useCallback(async (matterId: string) => {
    if (!matterId) return;
    setOutcomesLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('matter_outcomes')
        .select('id, inquiry_id, outcome, case_type, close_date, settlement_amount, notes, marketing_highlight, expertise_tags, created_at')
        .eq('inquiry_id', matterId)
        .order('close_date', { ascending: false });
      if (err) throw err;
      setOutcomes((data || []) as MatterOutcome[]);
    } catch (err: unknown) {
      setOutcomeError(err instanceof Error ? err.message : 'Failed to load outcomes');
    } finally {
      setOutcomesLoading(false);
    }
  }, [supabase]);

  // Load time entries for selected matter
  const loadEntries = useCallback(async (matterId: string) => {
    if (!matterId) return;
    setLoading(true);
    setError(null);
    try {
      const matter = matters.find(m => m.id === matterId);

      const [entriesRes, intakeRes] = await Promise.all([
        supabase
          .from('retainer_time_logs')
          .select('id, inquiry_id, hours, description, work_date, logged_by, assigned_to, billable, task_category, hourly_rate, created_at')
          .eq('inquiry_id', matterId)
          .order('work_date', { ascending: false }),
        matter?.email
          ? supabase
              .from('intake_submissions')
              .select('id, name, email, phone, case_type, case_description, opposing_party, urgency, additional_notes, submitted_at')
              .eq('email', matter.email)
              .order('submitted_at', { ascending: false })
              .limit(1)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (entriesRes.error) throw entriesRes.error;

      const entries = (entriesRes.data || []) as TimeEntry[];
      const billableEntries = entries.filter(e => e.billable !== false);
      const writeOffEntries = entries.filter(e => e.billable === false);

      const billableHours = billableEntries.reduce((s, e) => s + Number(e.hours), 0);
      const writeOffHours = writeOffEntries.reduce((s, e) => s + Number(e.hours), 0);
      const totalHours = billableHours + writeOffHours;

      const billableAmount = billableEntries.reduce((s, e) => s + Number(e.hours) * (Number(e.hourly_rate) || 0), 0);
      const writeOffAmount = writeOffEntries.reduce((s, e) => s + Number(e.hours) * (Number(e.hourly_rate) || 0), 0);

      const staffMetrics = buildStaffMetrics(entries, billableAmount);

      setMatterSummary({
        matterId,
        matterName: matter?.name || 'Unknown Matter',
        billableHours,
        writeOffHours,
        totalHours,
        billableAmount,
        writeOffAmount,
        writeOffRate: totalHours > 0 ? (writeOffHours / totalHours) * 100 : 0,
        entries,
        staffMetrics,
      });

      if (!intakeRes.error && intakeRes.data) {
        setIntakeData(intakeRes.data as IntakeSubmission);
        // Pre-fill case type from intake
        if (intakeRes.data.case_type && !outcomeForm.case_type) {
          setOutcomeForm(prev => ({ ...prev, case_type: intakeRes.data!.case_type }));
        }
      } else {
        setIntakeData(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load time entries');
    } finally {
      setLoading(false);
    }
  }, [matters, supabase, outcomeForm.case_type]);

  useEffect(() => {
    if (selectedMatterId) {
      loadEntries(selectedMatterId);
      loadOutcomes(selectedMatterId);
    } else {
      setMatterSummary(null);
      setIntakeData(null);
      setOutcomes([]);
    }
  }, [selectedMatterId, loadEntries, loadOutcomes]);

  // When a team member is selected in the form, auto-fill their rate
  const handleAssignedToChange = (name: string) => {
    setFormAssignedTo(name);
    const member = teamMembers.find(m => m.full_name === name);
    if (member?.hourly_rate) setFormRate(String(member.hourly_rate));
  };

  // Generate AI case summary
  const handleGenerateSummary = () => {
    if (!matterSummary) return;
    const matter = matters.find(m => m.id === selectedMatterId);

    setAiSummaryText('');
    setSummaryGenerated(false);

    const intakeSection = intakeData
      ? `INTAKE QUESTIONNAIRE DATA:
- Client: ${intakeData.name} (${intakeData.email}${intakeData.phone ? `, ${intakeData.phone}` : ''})
- Case Type: ${intakeData.case_type}
- Case Description: ${intakeData.case_description}
- Opposing Party: ${intakeData.opposing_party || 'Not specified'}
- Urgency: ${intakeData.urgency}
- Additional Notes: ${intakeData.additional_notes || 'None'}
- Intake Submitted: ${new Date(intakeData.submitted_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
      : 'INTAKE QUESTIONNAIRE DATA: Not available for this matter.';

    const recentNotes = matterSummary.entries
      .slice(0, 15)
      .map(e => {
        const catLabel = TASK_CATEGORIES.find(c => c.value === e.task_category)?.label || e.task_category;
        const dateStr = new Date(e.work_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return `  • [${dateStr}] ${catLabel} (${fmtHours(Number(e.hours))}${e.billable === false ? ', write-off' : ', billable'}): ${e.description || 'No description'}`;
      })
      .join('\n');

    const staffSection = matterSummary.staffMetrics.length > 0
      ? matterSummary.staffMetrics.map(s => `  • ${s.name}: ${fmtHours(s.billableHours)} billable, ${fmtHours(s.writeOffHours)} write-off, ${s.utilizationRate.toFixed(0)}% utilization`).join('\n')
      : '  • No staff assignments recorded';

    const prompt = `You are a legal case manager assistant. Generate a concise, professional matter case summary for quick client context. The summary should be 3–5 short paragraphs covering: (1) matter overview and client background, (2) key case details and current status, (3) work performed to date, and (4) billing snapshot. Be factual, clear, and attorney-ready.

MATTER: ${matterSummary.matterName}
SERVICE: ${matter?.service || 'Not specified'}
STATUS: ${matter?.status || 'Unknown'}

${intakeSection}

TIME LOG NOTES (most recent ${Math.min(matterSummary.entries.length, 15)} of ${matterSummary.entries.length} entries):
${recentNotes || '  • No time entries logged yet'}

STAFF ASSIGNED:
${staffSection}

BILLING SNAPSHOT:
- Total Hours: ${fmtHours(matterSummary.totalHours)} (${fmtHours(matterSummary.billableHours)} billable, ${fmtHours(matterSummary.writeOffHours)} write-off)
- Billable Value: ${fmt(matterSummary.billableAmount)}
- Write-Off Rate: ${matterSummary.writeOffRate.toFixed(1)}%

Generate the matter case summary now:`;

    sendMessage(
      [
        { role: 'system', content: 'You are a professional legal case manager assistant. Write concise, factual, attorney-ready matter summaries.' },
        { role: 'user', content: prompt },
      ],
      { max_completion_tokens: 600 }
    );
  };

  // Save outcome
  const handleSaveOutcome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMatterId) return;
    if (!outcomeForm.case_type.trim()) { setOutcomeError('Case type is required.'); return; }

    setSavingOutcome(true);
    setOutcomeError(null);
    setOutcomeSuccess(null);

    try {
      const tags = outcomeForm.expertise_tags
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);

      const { error: err } = await supabase.from('matter_outcomes').insert({
        inquiry_id: selectedMatterId,
        outcome: outcomeForm.outcome,
        case_type: outcomeForm.case_type.trim(),
        close_date: outcomeForm.close_date,
        settlement_amount: outcomeForm.settlement_amount ? parseFloat(outcomeForm.settlement_amount) : null,
        notes: outcomeForm.notes.trim() || null,
        marketing_highlight: outcomeForm.marketing_highlight,
        expertise_tags: tags,
      });
      if (err) throw err;

      // ── Auto-send matter-close emails to client + staff ──────────────────
      const matter = matters.find(m => m.id === selectedMatterId);
      if (matter?.email) {
        try {
          const emailRes = await fetch('/api/matter-close/send-emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              inquiryId: selectedMatterId,
              clientName: matter.name,
              clientEmail: matter.email,
              caseType: outcomeForm.case_type.trim(),
              outcome: outcomeForm.outcome,
              closeDate: outcomeForm.close_date,
              settlementAmount: outcomeForm.settlement_amount ? parseFloat(outcomeForm.settlement_amount) : null,
              notes: outcomeForm.notes.trim() || null,
            }),
          });
          const emailData = await emailRes.json() as { success?: boolean; sent?: number; errors?: { recipient: string; error: string }[] };
          if (emailData.success) {
            setOutcomeSuccess(`Outcome recorded. ${emailData.sent ?? 0} notification email${(emailData.sent ?? 0) !== 1 ? 's' : ''} sent to client and staff.`);
          } else {
            setOutcomeSuccess('Outcome recorded. Email notifications could not be sent — check Resend API key.');
          }
        } catch {
          setOutcomeSuccess('Outcome recorded successfully. (Email notifications unavailable — check configuration.)');
        }
      } else {
        setOutcomeSuccess('Outcome recorded successfully.');
      }
      // ────────────────────────────────────────────────────────────────────

      setOutcomeForm(prev => ({ ...prev, settlement_amount: '', notes: '', expertise_tags: '', marketing_highlight: false }));
      await loadOutcomes(selectedMatterId);
      // Refresh all outcomes for analytics
      const { data } = await supabase
        .from('matter_outcomes')
        .select('id, inquiry_id, outcome, case_type, close_date, settlement_amount, notes, marketing_highlight, expertise_tags, created_at')
        .order('close_date', { ascending: false });
      if (data) setAllOutcomes(data as MatterOutcome[]);
    } catch (err: unknown) {
      setOutcomeError(err instanceof Error ? err.message : 'Failed to save outcome');
    } finally {
      setSavingOutcome(false);
    }
  };

  // Delete outcome
  const handleDeleteOutcome = async (outcomeId: string) => {
    setDeletingOutcomeId(outcomeId);
    try {
      const { error: err } = await supabase.from('matter_outcomes').delete().eq('id', outcomeId);
      if (err) throw err;
      await loadOutcomes(selectedMatterId);
      const { data } = await supabase
        .from('matter_outcomes')
        .select('id, inquiry_id, outcome, case_type, close_date, settlement_amount, notes, marketing_highlight, expertise_tags, created_at')
        .order('close_date', { ascending: false });
      if (data) setAllOutcomes(data as MatterOutcome[]);
    } catch (err: unknown) {
      setOutcomeError(err instanceof Error ? err.message : 'Failed to delete outcome');
    } finally {
      setDeletingOutcomeId(null);
    }
  };

  // Submit new entry
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMatterId) { setError('Please select a matter first.'); return; }
    const hrs = parseFloat(formHours);
    if (isNaN(hrs) || hrs <= 0) { setError('Enter a valid duration (hours > 0).'); return; }
    if (!formDescription.trim()) { setError('Description is required.'); return; }

    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const { error: err } = await supabase.from('retainer_time_logs').insert({
        inquiry_id: selectedMatterId,
        hours: hrs,
        description: formDescription.trim(),
        work_date: formDate,
        logged_by: formLoggedBy.trim() || 'Admin',
        assigned_to: formAssignedTo.trim() || formLoggedBy.trim() || 'Admin',
        billable: formBillable,
        task_category: formCategory,
        hourly_rate: parseFloat(formRate) || 0,
      });
      if (err) throw err;

      setSuccessMsg(`${formBillable ? 'Billable' : 'Write-off'} entry of ${fmtHours(hrs)} logged for ${formAssignedTo || formLoggedBy || 'Admin'}.`);
      setFormHours('');
      setFormDescription('');
      await loadEntries(selectedMatterId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save time entry');
    } finally {
      setSaving(false);
    }
  };

  // Delete entry
  const handleDelete = async (entryId: string) => {
    setDeletingId(entryId);
    try {
      const { error: err } = await supabase.from('retainer_time_logs').delete().eq('id', entryId);
      if (err) throw err;
      await loadEntries(selectedMatterId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete entry');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredEntries = matterSummary?.entries.filter(e => {
    if (filterBillable === 'billable') return e.billable !== false;
    if (filterBillable === 'writeoff') return e.billable === false;
    return true;
  }) || [];

  // ─── Outcomes Analytics ──────────────────────────────────────────────────────

  // Success rate by case type (from all outcomes)
  const successByCaseType = (() => {
    const map = new Map<string, { total: number; favorable: number }>();
    for (const o of allOutcomes) {
      const ct = o.case_type || 'Unknown';
      if (!map.has(ct)) map.set(ct, { total: 0, favorable: 0 });
      const entry = map.get(ct)!;
      entry.total += 1;
      if (FAVORABLE_OUTCOMES.has(o.outcome)) entry.favorable += 1;
    }
    return [...map.entries()]
      .map(([caseType, stats]) => ({
        caseType,
        total: stats.total,
        favorable: stats.favorable,
        successRate: stats.total > 0 ? Math.round((stats.favorable / stats.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  })();

  // Outcome distribution for pie chart
  const outcomeDist = (() => {
    const map = new Map<string, number>();
    for (const o of allOutcomes) {
      map.set(o.outcome, (map.get(o.outcome) || 0) + 1);
    }
    return [...map.entries()].map(([name, value]) => ({ name, value, label: getOutcomeMeta(name).label }));
  })();

  // Expertise strength areas (tag frequency across all marketing-highlighted outcomes)
  const expertiseTags = (() => {
    const map = new Map<string, number>();
    for (const o of allOutcomes) {
      if (o.marketing_highlight && o.expertise_tags?.length) {
        for (const tag of o.expertise_tags) {
          map.set(tag, (map.get(tag) || 0) + 1);
        }
      }
    }
    return [...map.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  })();

  // Overall success rate
  const totalMatters = allOutcomes.length;
  const favorableCount = allOutcomes.filter(o => FAVORABLE_OUTCOMES.has(o.outcome)).length;
  const overallSuccessRate = totalMatters > 0 ? Math.round((favorableCount / totalMatters) * 100) : 0;
  const marketingHighlights = allOutcomes.filter(o => o.marketing_highlight);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-primary">Matter Time Logger</h2>
        <p className="text-sm text-secondary mt-1">Track billable and write-off hours per matter, assigned to team members, with utilization and revenue contribution.</p>
      </div>

      {/* Matter Selector */}
      <div className="bg-white border border-border rounded-xl p-4">
        <label className="block text-sm font-semibold text-primary mb-2">Select Matter</label>
        <select
          value={selectedMatterId}
          onChange={e => setSelectedMatterId(e.target.value)}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm text-primary bg-white focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="">— Choose a matter —</option>
          {matters.map(m => (
            <option key={m.id} value={m.id}>
              {m.name} {m.service ? `· ${m.service}` : ''} {m.status ? `(${m.status})` : ''}
            </option>
          ))}
        </select>
      </div>

      {selectedMatterId && (
        <>
          {/* KPI Summary */}
          {matterSummary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white border border-border rounded-xl p-4">
                <p className="text-xs text-secondary uppercase tracking-wide font-semibold">Billable Hours</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{fmtHours(matterSummary.billableHours)}</p>
                <p className="text-xs text-secondary mt-0.5">{fmt(matterSummary.billableAmount)} value</p>
              </div>
              <div className="bg-white border border-border rounded-xl p-4">
                <p className="text-xs text-secondary uppercase tracking-wide font-semibold">Write-Off Hours</p>
                <p className="text-2xl font-bold text-red-500 mt-1">{fmtHours(matterSummary.writeOffHours)}</p>
                <p className="text-xs text-secondary mt-0.5">{fmt(matterSummary.writeOffAmount)} written off</p>
              </div>
              <div className="bg-white border border-border rounded-xl p-4">
                <p className="text-xs text-secondary uppercase tracking-wide font-semibold">Total Hours</p>
                <p className="text-2xl font-bold text-primary mt-1">{fmtHours(matterSummary.totalHours)}</p>
                <p className="text-xs text-secondary mt-0.5">{matterSummary.entries.length} entries · {matterSummary.staffMetrics.length} staff</p>
              </div>
              <div className="bg-white border border-border rounded-xl p-4">
                <p className="text-xs text-secondary uppercase tracking-wide font-semibold">Write-Off Rate</p>
                <p className={`text-2xl font-bold mt-1 ${matterSummary.writeOffRate > 20 ? 'text-red-500' : matterSummary.writeOffRate > 10 ? 'text-amber-500' : 'text-green-600'}`}>
                  {matterSummary.writeOffRate.toFixed(1)}%
                </p>
                <p className="text-xs text-secondary mt-0.5">of total hours</p>
              </div>
            </div>
          )}

          {/* Tab Navigation */}
          <div className="flex flex-wrap gap-1 bg-secondary/10 rounded-xl p-1 w-fit">
            <button
              onClick={() => setActiveTab('log')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'log' ? 'bg-white text-primary shadow-sm' : 'text-secondary hover:text-primary'}`}
            >
              Log Time
            </button>
            <button
              onClick={() => setActiveTab('staff')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${activeTab === 'staff' ? 'bg-white text-primary shadow-sm' : 'text-secondary hover:text-primary'}`}
            >
              Staff Utilization
              {matterSummary && matterSummary.staffMetrics.length > 0 && (
                <span className="bg-accent text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
                  {matterSummary.staffMetrics.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('outcomes')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${activeTab === 'outcomes' ? 'bg-white text-primary shadow-sm' : 'text-secondary hover:text-primary'}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
              Outcomes
              {outcomes.length > 0 && (
                <span className="bg-green-600 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
                  {outcomes.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('summary')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${activeTab === 'summary' ? 'bg-white text-primary shadow-sm' : 'text-secondary hover:text-primary'}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Case Summary
            </button>
          </div>

          {/* ── TAB: Log Time ── */}
          {activeTab === 'log' && (
            <>
              {/* Log Entry Form */}
              <div className="bg-white border border-border rounded-xl p-5">
                <h3 className="text-base font-semibold text-primary mb-4">Log Time Entry</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Billable Toggle */}
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setFormBillable(true)}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border transition-colors ${formBillable ? 'bg-green-600 text-white border-green-600' : 'bg-white text-secondary border-border hover:border-green-400'}`}
                    >
                      ✓ Billable
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormBillable(false)}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border transition-colors ${!formBillable ? 'bg-red-500 text-white border-red-500' : 'bg-white text-secondary border-border hover:border-red-400'}`}
                    >
                      ✗ Write-Off
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-secondary mb-1">Date</label>
                      <input
                        type="date"
                        value={formDate}
                        onChange={e => setFormDate(e.target.value)}
                        required
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-secondary mb-1">Duration (hours)</label>
                      <input
                        type="number"
                        value={formHours}
                        onChange={e => setFormHours(e.target.value)}
                        placeholder="e.g. 1.5"
                        min="0.1"
                        step="0.1"
                        required
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-secondary mb-1">Hourly Rate ($)</label>
                      <input
                        type="number"
                        value={formRate}
                        onChange={e => setFormRate(e.target.value)}
                        placeholder="250"
                        min="0"
                        step="5"
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-secondary mb-1">Task Category</label>
                      <select
                        value={formCategory}
                        onChange={e => setFormCategory(e.target.value)}
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm text-primary bg-white focus:outline-none focus:ring-2 focus:ring-accent"
                      >
                        {TASK_CATEGORIES.map(c => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-secondary mb-1">Assign To (Team Member)</label>
                      <select
                        value={formAssignedTo}
                        onChange={e => handleAssignedToChange(e.target.value)}
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm text-primary bg-white focus:outline-none focus:ring-2 focus:ring-accent"
                      >
                        <option value="">— Select staff member —</option>
                        {teamMembers.map(m => (
                          <option key={m.id} value={m.full_name}>
                            {m.full_name}{m.title ? ` · ${m.title}` : ''}
                          </option>
                        ))}
                        <option value="Admin">Admin</option>
                        <option value="Attorney">Attorney</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-secondary mb-1">Logged By</label>
                      <input
                        type="text"
                        value={formLoggedBy}
                        onChange={e => setFormLoggedBy(e.target.value)}
                        placeholder="Admin"
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-secondary mb-1">Description</label>
                    <textarea
                      value={formDescription}
                      onChange={e => setFormDescription(e.target.value)}
                      placeholder="Describe the work performed..."
                      rows={2}
                      required
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                    />
                  </div>

                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">{error}</div>
                  )}
                  {successMsg && (
                    <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-2">{successMsg}</div>
                  )}

                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full bg-accent text-white py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {saving ? 'Saving…' : `Log ${formBillable ? 'Billable' : 'Write-Off'} Time`}
                  </button>
                </form>
              </div>

              {/* Entries Table */}
              <div className="bg-white border border-border rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                  <h3 className="text-base font-semibold text-primary">Time Entries</h3>
                  <div className="flex gap-2">
                    {(['all', 'billable', 'writeoff'] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setFilterBillable(f)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${filterBillable === f ? 'bg-accent text-white border-accent' : 'bg-white text-secondary border-border hover:border-accent'}`}
                      >
                        {f === 'all' ? 'All' : f === 'billable' ? 'Billable' : 'Write-Off'}
                      </button>
                    ))}
                  </div>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-12 text-secondary text-sm">Loading entries…</div>
                ) : filteredEntries.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-secondary text-sm">
                    <p>No time entries found.</p>
                    <p className="text-xs mt-1">Log the first entry using the form above.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-secondary/5 border-b border-border">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wide">Date</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wide">Type</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wide">Category</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wide">Description</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wide">Assigned To</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wide">Hours</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wide">Rate</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wide">Amount</th>
                          <th className="px-4 py-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredEntries.map(entry => {
                          const isBillable = entry.billable !== false;
                          const amount = Number(entry.hours) * (Number(entry.hourly_rate) || 0);
                          const catLabel = TASK_CATEGORIES.find(c => c.value === entry.task_category)?.label || entry.task_category;
                          const catColor = CATEGORY_COLORS[entry.task_category] || 'bg-slate-100 text-slate-600';
                          const assignedName = entry.assigned_to || entry.logged_by || '—';
                          return (
                            <tr key={entry.id} className="hover:bg-secondary/5 transition-colors">
                              <td className="px-4 py-3 text-primary whitespace-nowrap">
                                {new Date(entry.work_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isBillable ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                                  {isBillable ? 'Billable' : 'Write-Off'}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${catColor}`}>{catLabel}</span>
                              </td>
                              <td className="px-4 py-3 text-primary max-w-xs truncate" title={entry.description || ''}>
                                {entry.description || '—'}
                              </td>
                              <td className="px-4 py-3 text-secondary text-xs font-medium">{assignedName}</td>
                              <td className="px-4 py-3 text-right font-semibold text-primary">{fmtHours(Number(entry.hours))}</td>
                              <td className="px-4 py-3 text-right text-secondary">{entry.hourly_rate ? `$${Number(entry.hourly_rate).toFixed(0)}/hr` : '—'}</td>
                              <td className={`px-4 py-3 text-right font-semibold ${isBillable ? 'text-green-600' : 'text-red-500'}`}>
                                {isBillable ? fmt(amount) : `(${fmt(amount)})`}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  onClick={() => handleDelete(entry.id)}
                                  disabled={deletingId === entry.id}
                                  className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40 transition-colors"
                                  title="Delete entry"
                                >
                                  {deletingId === entry.id ? '…' : '✕'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="border-t-2 border-border bg-secondary/5">
                        <tr>
                          <td colSpan={5} className="px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wide">Totals</td>
                          <td className="px-4 py-3 text-right font-bold text-primary">
                            {fmtHours(filteredEntries.reduce((s, e) => s + Number(e.hours), 0))}
                          </td>
                          <td className="px-4 py-3"></td>
                          <td className="px-4 py-3 text-right font-bold text-primary">
                            {fmt(filteredEntries.reduce((s, e) => s + Number(e.hours) * (Number(e.hourly_rate) || 0), 0))}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── TAB: Staff Utilization ── */}
          {activeTab === 'staff' && (
            <div className="space-y-6">
              {loading ? (
                <div className="bg-white border border-border rounded-xl flex items-center justify-center py-16 text-secondary text-sm">Loading staff data…</div>
              ) : !matterSummary || matterSummary.staffMetrics.length === 0 ? (
                <div className="bg-white border border-border rounded-xl flex flex-col items-center justify-center py-16 text-secondary text-sm">
                  <svg className="w-10 h-10 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <p className="font-medium">No staff data yet.</p>
                  <p className="text-xs mt-1">Log time entries with team member assignments to see utilization metrics.</p>
                </div>
              ) : (
                <>
                  {/* Staff KPI Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white border border-border rounded-xl p-4">
                      <p className="text-xs text-secondary uppercase tracking-wide font-semibold">Team Members</p>
                      <p className="text-2xl font-bold text-primary mt-1">{matterSummary.staffMetrics.length}</p>
                      <p className="text-xs text-secondary mt-0.5">assigned to this matter</p>
                    </div>
                    <div className="bg-white border border-border rounded-xl p-4">
                      <p className="text-xs text-secondary uppercase tracking-wide font-semibold">Avg Utilization</p>
                      <p className="text-2xl font-bold text-primary mt-1">
                        {matterSummary.staffMetrics.length > 0
                          ? `${(matterSummary.staffMetrics.reduce((s, m) => s + m.utilizationRate, 0) / matterSummary.staffMetrics.length).toFixed(0)}%`
                          : '—'}
                      </p>
                      <p className="text-xs text-secondary mt-0.5">billable / total hours</p>
                    </div>
                    <div className="bg-white border border-border rounded-xl p-4">
                      <p className="text-xs text-secondary uppercase tracking-wide font-semibold">Total Revenue</p>
                      <p className="text-2xl font-bold text-green-600 mt-1">{fmt(matterSummary.billableAmount)}</p>
                      <p className="text-xs text-secondary mt-0.5">from billable hours</p>
                    </div>
                  </div>

                  {/* Staff Metrics Table */}
                  <div className="bg-white border border-border rounded-xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-border">
                      <h3 className="text-base font-semibold text-primary">Per-Staff Breakdown</h3>
                      <p className="text-xs text-secondary mt-0.5">Billable hours, write-offs, utilization rate, and revenue contribution per team member</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-secondary/5 border-b border-border">
                            <th className="text-left px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wide">Team Member</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wide">Billable Hrs</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wide">Write-Off Hrs</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wide">Total Hrs</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wide">Utilization</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wide">Revenue</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wide">Rev Share</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {matterSummary.staffMetrics.map((s, idx) => {
                            const utilColor = s.utilizationRate >= 75 ? 'text-green-600' : s.utilizationRate >= 50 ? 'text-amber-500' : 'text-red-500';
                            const barColor = STAFF_COLORS[idx % STAFF_COLORS.length];
                            return (
                              <tr key={s.name} className="hover:bg-secondary/5 transition-colors">
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: barColor }} />
                                    <span className="font-medium text-primary">{s.name}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right font-semibold text-green-600">{fmtHours(s.billableHours)}</td>
                                <td className="px-4 py-3 text-right text-red-500">{fmtHours(s.writeOffHours)}</td>
                                <td className="px-4 py-3 text-right text-primary font-medium">{fmtHours(s.totalHours)}</td>
                                <td className="px-4 py-3 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <div className="w-16 bg-secondary/10 rounded-full h-1.5 overflow-hidden">
                                      <div
                                        className="h-full rounded-full"
                                        style={{ width: `${Math.min(s.utilizationRate, 100)}%`, backgroundColor: barColor }}
                                      />
                                    </div>
                                    <span className={`font-semibold text-xs ${utilColor}`}>{s.utilizationRate.toFixed(0)}%</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right font-semibold text-green-600">{fmt(s.revenueContribution)}</td>
                                <td className="px-4 py-3 text-right">
                                  <span className="text-xs font-semibold text-secondary">{s.revenueShare.toFixed(1)}%</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="border-t-2 border-border bg-secondary/5">
                          <tr>
                            <td className="px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wide">Total</td>
                            <td className="px-4 py-3 text-right font-bold text-green-600">{fmtHours(matterSummary.billableHours)}</td>
                            <td className="px-4 py-3 text-right font-bold text-red-500">{fmtHours(matterSummary.writeOffHours)}</td>
                            <td className="px-4 py-3 text-right font-bold text-primary">{fmtHours(matterSummary.totalHours)}</td>
                            <td className="px-4 py-3 text-right font-bold text-primary">
                              {matterSummary.totalHours > 0 ? `${((matterSummary.billableHours / matterSummary.totalHours) * 100).toFixed(0)}%` : '—'}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-green-600">{fmt(matterSummary.billableAmount)}</td>
                            <td className="px-4 py-3 text-right font-bold text-secondary">100%</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* Hours Bar Chart */}
                  <div className="bg-white border border-border rounded-xl p-5">
                    <h3 className="text-base font-semibold text-primary mb-4">Hours by Team Member</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart
                        data={matterSummary.staffMetrics.map(s => ({
                          name: s.name.split(' ')[0],
                          Billable: parseFloat(s.billableHours.toFixed(1)),
                          'Write-Off': parseFloat(s.writeOffHours.toFixed(1)),
                        }))}
                        margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} unit="h" />
                        <Tooltip formatter={(v: number) => `${v}h`} />
                        <Bar dataKey="Billable" fill="#355E3B" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Write-Off" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Revenue Contribution Bar Chart */}
                  <div className="bg-white border border-border rounded-xl p-5">
                    <h3 className="text-base font-semibold text-primary mb-1">Revenue Contribution per Staff</h3>
                    <p className="text-xs text-secondary mb-4">Billable hours × hourly rate per team member</p>
                    <div className="space-y-3">
                      {matterSummary.staffMetrics.map((s, idx) => (
                        <div key={s.name}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-primary">{s.name}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-secondary">{fmtHours(s.billableHours)} billable</span>
                              <span className="text-sm font-semibold text-green-600">{fmt(s.revenueContribution)}</span>
                              <span className="text-xs text-secondary w-10 text-right">{s.revenueShare.toFixed(1)}%</span>
                            </div>
                          </div>
                          <div className="w-full bg-secondary/10 rounded-full h-2 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${Math.min(s.revenueShare, 100)}%`, backgroundColor: STAFF_COLORS[idx % STAFF_COLORS.length] }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── TAB: Outcomes ── */}
          {activeTab === 'outcomes' && (
            <div className="space-y-6">
              {/* Overall KPIs (from all matters) */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white border border-border rounded-xl p-4">
                  <p className="text-xs text-secondary uppercase tracking-wide font-semibold">Overall Success Rate</p>
                  <p className={`text-2xl font-bold mt-1 ${overallSuccessRate >= 70 ? 'text-green-600' : overallSuccessRate >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                    {overallSuccessRate}%
                  </p>
                  <p className="text-xs text-secondary mt-0.5">{favorableCount} of {totalMatters} matters</p>
                </div>
                <div className="bg-white border border-border rounded-xl p-4">
                  <p className="text-xs text-secondary uppercase tracking-wide font-semibold">Closed Matters</p>
                  <p className="text-2xl font-bold text-primary mt-1">{totalMatters}</p>
                  <p className="text-xs text-secondary mt-0.5">across all case types</p>
                </div>
                <div className="bg-white border border-border rounded-xl p-4">
                  <p className="text-xs text-secondary uppercase tracking-wide font-semibold">Marketing Highlights</p>
                  <p className="text-2xl font-bold text-indigo-600 mt-1">{marketingHighlights.length}</p>
                  <p className="text-xs text-secondary mt-0.5">flagged for marketing</p>
                </div>
                <div className="bg-white border border-border rounded-xl p-4">
                  <p className="text-xs text-secondary uppercase tracking-wide font-semibold">This Matter</p>
                  <p className="text-2xl font-bold text-primary mt-1">{outcomes.length}</p>
                  <p className="text-xs text-secondary mt-0.5">outcome{outcomes.length !== 1 ? 's' : ''} recorded</p>
                </div>
              </div>

              {/* Record Outcome Form */}
              <div className="bg-white border border-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-primary">Record Matter Outcome</h3>
                    <p className="text-xs text-secondary">Log the closed matter result for success tracking and marketing</p>
                  </div>
                </div>
                <form onSubmit={handleSaveOutcome} className="space-y-4">
                  {/* Outcome selector */}
                  <div>
                    <label className="block text-xs font-semibold text-secondary mb-2">Outcome</label>
                    <div className="flex flex-wrap gap-2">
                      {OUTCOME_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setOutcomeForm(prev => ({ ...prev, outcome: opt.value }))}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                            outcomeForm.outcome === opt.value
                              ? `${opt.color} border-current`
                              : 'bg-white text-secondary border-border hover:border-secondary'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${opt.dot}`} />
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-secondary mb-1">Case Type <span className="text-red-400">*</span></label>
                      <input
                        type="text"
                        value={outcomeForm.case_type}
                        onChange={e => setOutcomeForm(prev => ({ ...prev, case_type: e.target.value }))}
                        placeholder="e.g. Personal Injury"
                        required
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-secondary mb-1">Close Date</label>
                      <input
                        type="date"
                        value={outcomeForm.close_date}
                        onChange={e => setOutcomeForm(prev => ({ ...prev, close_date: e.target.value }))}
                        required
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-secondary mb-1">Settlement Amount ($)</label>
                      <input
                        type="number"
                        value={outcomeForm.settlement_amount}
                        onChange={e => setOutcomeForm(prev => ({ ...prev, settlement_amount: e.target.value }))}
                        placeholder="Optional"
                        min="0"
                        step="100"
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-secondary mb-1">Expertise Tags <span className="text-secondary font-normal">(comma-separated, for marketing)</span></label>
                    <input
                      type="text"
                      value={outcomeForm.expertise_tags}
                      onChange={e => setOutcomeForm(prev => ({ ...prev, expertise_tags: e.target.value }))}
                      placeholder="e.g. personal injury, trial, jury verdict, negligence"
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-secondary mb-1">Notes</label>
                    <textarea
                      value={outcomeForm.notes}
                      onChange={e => setOutcomeForm(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Brief outcome summary for internal records..."
                      rows={2}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setOutcomeForm(prev => ({ ...prev, marketing_highlight: !prev.marketing_highlight }))}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${outcomeForm.marketing_highlight ? 'bg-accent' : 'bg-secondary/30'}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${outcomeForm.marketing_highlight ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                    <label className="text-sm text-primary font-medium cursor-pointer" onClick={() => setOutcomeForm(prev => ({ ...prev, marketing_highlight: !prev.marketing_highlight }))}>
                      Flag for marketing use
                    </label>
                    <span className="text-xs text-secondary">(highlights this win in expertise analytics)</span>
                  </div>

                  {outcomeError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">{outcomeError}</div>
                  )}
                  {outcomeSuccess && (
                    <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-2">{outcomeSuccess}</div>
                  )}

                  <button
                    type="submit"
                    disabled={savingOutcome}
                    className="w-full bg-accent text-white py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {savingOutcome ? 'Saving…' : 'Record Outcome'}
                  </button>
                </form>
              </div>

              {/* This matter's outcomes */}
              {outcomesLoading ? (
                <div className="bg-white border border-border rounded-xl flex items-center justify-center py-10 text-secondary text-sm">Loading outcomes…</div>
              ) : outcomes.length > 0 ? (
                <div className="bg-white border border-border rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-border">
                    <h3 className="text-base font-semibold text-primary">Recorded Outcomes — This Matter</h3>
                  </div>
                  <div className="divide-y divide-border">
                    {outcomes.map(o => {
                      const meta = getOutcomeMeta(o.outcome);
                      return (
                        <div key={o.id} className="px-5 py-4 flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 min-w-0">
                            <span className={`mt-0.5 flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${meta.color}`}>{meta.label}</span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-primary">{o.case_type}</span>
                                <span className="text-xs text-secondary">
                                  {new Date(o.close_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </span>
                                {o.settlement_amount && (
                                  <span className="text-xs font-semibold text-green-600">{fmt(Number(o.settlement_amount))}</span>
                                )}
                                {o.marketing_highlight && (
                                  <span className="text-xs bg-indigo-50 text-indigo-600 font-semibold px-2 py-0.5 rounded-full">Marketing</span>
                                )}
                              </div>
                              {o.notes && <p className="text-xs text-secondary mt-1 leading-relaxed">{o.notes}</p>}
                              {o.expertise_tags?.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {o.expertise_tags.map(tag => (
                                    <span key={tag} className="text-xs bg-secondary/10 text-secondary px-2 py-0.5 rounded-full">{tag}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteOutcome(o.id)}
                            disabled={deletingOutcomeId === o.id}
                            className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40 flex-shrink-0 transition-colors"
                          >
                            {deletingOutcomeId === o.id ? '…' : '✕'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {/* Analytics: Success Rate by Case Type */}
              {successByCaseType.length > 0 && (
                <div className="bg-white border border-border rounded-xl p-5">
                  <h3 className="text-base font-semibold text-primary mb-1">Success Rate by Case Type</h3>
                  <p className="text-xs text-secondary mb-4">Favorable outcomes (won, settled, favorable judgment, dismissed) across all closed matters</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={successByCaseType.map(d => ({
                        name: d.caseType.length > 14 ? d.caseType.slice(0, 13) + '…' : d.caseType,
                        'Success Rate': d.successRate,
                        Total: d.total,
                      }))}
                      margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
                      <Tooltip
                        formatter={(value: number, name: string) => name === 'Success Rate' ? [`${value}%`, name] : [value, name]}
                      />
                      <Bar dataKey="Success Rate" fill="#355E3B" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  {/* Table */}
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-secondary/5 border-b border-border">
                          <th className="text-left px-3 py-2 text-xs font-semibold text-secondary uppercase tracking-wide">Case Type</th>
                          <th className="text-right px-3 py-2 text-xs font-semibold text-secondary uppercase tracking-wide">Total</th>
                          <th className="text-right px-3 py-2 text-xs font-semibold text-secondary uppercase tracking-wide">Favorable</th>
                          <th className="text-right px-3 py-2 text-xs font-semibold text-secondary uppercase tracking-wide">Success Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {successByCaseType.map(row => (
                          <tr key={row.caseType} className="hover:bg-secondary/5">
                            <td className="px-3 py-2 font-medium text-primary">{row.caseType}</td>
                            <td className="px-3 py-2 text-right text-secondary">{row.total}</td>
                            <td className="px-3 py-2 text-right text-green-600 font-semibold">{row.favorable}</td>
                            <td className="px-3 py-2 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 bg-secondary/10 rounded-full h-1.5 overflow-hidden">
                                  <div className="h-full rounded-full bg-accent" style={{ width: `${row.successRate}%` }} />
                                </div>
                                <span className={`font-bold text-xs ${row.successRate >= 70 ? 'text-green-600' : row.successRate >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                                  {row.successRate}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Outcome Distribution Pie */}
              {outcomeDist.length > 0 && (
                <div className="bg-white border border-border rounded-xl p-5">
                  <h3 className="text-base font-semibold text-primary mb-4">Outcome Distribution — All Matters</h3>
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={outcomeDist}
                          dataKey="value"
                          nameKey="label"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={({ label, percent }) => `${label} ${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {outcomeDist.map((entry, idx) => (
                            <Cell key={entry.name} fill={OUTCOME_CHART_COLORS[entry.name] || STAFF_COLORS[idx % STAFF_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number, name: string) => [v, name]} />
                        <Legend formatter={(value) => value} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Expertise Strength Areas */}
              {expertiseTags.length > 0 && (
                <div className="bg-white border border-border rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-primary">Expertise Strength Areas</h3>
                      <p className="text-xs text-secondary">Tags from marketing-highlighted wins — use for website, profiles, and pitches</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {expertiseTags.map(({ tag, count }) => {
                      const maxCount = expertiseTags[0]?.count || 1;
                      const intensity = Math.round((count / maxCount) * 5);
                      const sizeClass = intensity >= 5 ? 'text-base px-4 py-2' : intensity >= 4 ? 'text-sm px-3.5 py-1.5' : intensity >= 3 ? 'text-sm px-3 py-1.5' : 'text-xs px-3 py-1';
                      return (
                        <span
                          key={tag}
                          className={`inline-flex items-center gap-1.5 rounded-full font-semibold bg-accent/10 text-accent border border-accent/20 ${sizeClass}`}
                          title={`${count} marketing highlight${count !== 1 ? 's' : ''}`}
                        >
                          {tag}
                          <span className="text-xs opacity-60 font-normal">×{count}</span>
                        </span>
                      );
                    })}
                  </div>
                  <p className="text-xs text-secondary mt-3">Larger tags = more frequently cited across winning matters. Use these to highlight your strongest practice areas.</p>
                </div>
              )}

              {/* Empty state */}
              {allOutcomes.length === 0 && (
                <div className="bg-white border border-border rounded-xl flex flex-col items-center justify-center py-16 text-secondary text-sm">
                  <svg className="w-10 h-10 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                  <p className="font-medium">No outcomes recorded yet.</p>
                  <p className="text-xs mt-1">Record the first closed matter outcome using the form above.</p>
                </div>
              )}
            </div>
          )}

          {/* ── TAB: Case Summary (AI) ── */}
          {activeTab === 'summary' && (
            <div className="space-y-5">
              {/* Intake Data Card */}
              {intakeData ? (
                <div className="bg-white border border-border rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-primary">Intake Questionnaire</h3>
                      <p className="text-xs text-secondary">Submitted {new Date(intakeData.submitted_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                    <div>
                      <span className="text-xs font-semibold text-secondary uppercase tracking-wide">Case Type</span>
                      <p className="text-primary mt-0.5">{intakeData.case_type}</p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-secondary uppercase tracking-wide">Urgency</span>
                      <p className="text-primary mt-0.5 capitalize">{intakeData.urgency}</p>
                    </div>
                    {intakeData.opposing_party && (
                      <div>
                        <span className="text-xs font-semibold text-secondary uppercase tracking-wide">Opposing Party</span>
                        <p className="text-primary mt-0.5">{intakeData.opposing_party}</p>
                      </div>
                    )}
                    <div className="sm:col-span-2">
                      <span className="text-xs font-semibold text-secondary uppercase tracking-wide">Case Description</span>
                      <p className="text-primary mt-0.5 leading-relaxed">{intakeData.case_description}</p>
                    </div>
                    {intakeData.additional_notes && (
                      <div className="sm:col-span-2">
                        <span className="text-xs font-semibold text-secondary uppercase tracking-wide">Additional Notes</span>
                        <p className="text-primary mt-0.5 leading-relaxed">{intakeData.additional_notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-start gap-3">
                  <svg className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-sm text-amber-700">No intake questionnaire found for this matter. The AI summary will be based on time log notes only.</p>
                </div>
              )}

              {/* Time Log Notes Preview */}
              {matterSummary && matterSummary.entries.length > 0 && (
                <div className="bg-white border border-border rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-primary">Time Log Notes</h3>
                      <p className="text-xs text-secondary">{matterSummary.entries.length} entries · {fmtHours(matterSummary.totalHours)} total</p>
                    </div>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {matterSummary.entries.slice(0, 10).map(e => {
                      const catLabel = TASK_CATEGORIES.find(c => c.value === e.task_category)?.label || e.task_category;
                      const catColor = CATEGORY_COLORS[e.task_category] || 'bg-slate-100 text-slate-600';
                      return (
                        <div key={e.id} className="flex items-start gap-2 text-xs">
                          <span className={`px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${catColor}`}>{catLabel}</span>
                          <span className="text-secondary flex-shrink-0">{fmtHours(Number(e.hours))}</span>
                          <span className="text-primary leading-relaxed">{e.description || '—'}</span>
                        </div>
                      );
                    })}
                    {matterSummary.entries.length > 10 && (
                      <p className="text-xs text-secondary italic">+ {matterSummary.entries.length - 10} more entries included in summary</p>
                    )}
                  </div>
                </div>
              )}

              {/* AI Summary Generator */}
              <div className="bg-white border border-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-primary">AI Case Summary</h3>
                      <p className="text-xs text-secondary">Auto-generated from intake data and time log notes</p>
                    </div>
                  </div>
                  <button
                    onClick={handleGenerateSummary}
                    disabled={aiLoading || !matterSummary}
                    className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {aiLoading ? (
                      <>
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Generating…
                      </>
                    ) : summaryGenerated ? (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Regenerate
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Generate Summary
                      </>
                    )}
                  </button>
                </div>

                {/* Summary Output */}
                {(aiLoading && aiSummaryText) || summaryGenerated ? (
                  <div className="bg-secondary/5 rounded-xl p-4 border border-border">
                    <div className="prose prose-sm max-w-none text-primary leading-relaxed whitespace-pre-wrap text-sm">
                      {aiSummaryText}
                      {aiLoading && (
                        <span className="inline-block w-1.5 h-4 bg-accent ml-0.5 animate-pulse rounded-sm" />
                      )}
                    </div>
                    {summaryGenerated && (
                      <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                        <p className="text-xs text-secondary">Generated from {matterSummary?.entries.length || 0} time entries{intakeData ? ' + intake questionnaire' : ''}</p>
                        <button
                          onClick={() => {
                            if (aiSummaryText) {
                              navigator.clipboard.writeText(aiSummaryText);
                              toast.success('Summary copied to clipboard');
                            }
                          }}
                          className="text-xs text-accent hover:underline font-medium flex items-center gap-1"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Copy
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-secondary/5 rounded-xl p-8 border border-dashed border-border flex flex-col items-center justify-center text-center">
                    <svg className="w-8 h-8 text-secondary/40 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <p className="text-sm font-medium text-secondary">No summary yet</p>
                    <p className="text-xs text-secondary/70 mt-1">Click "Generate Summary" to create an AI-powered matter overview</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {!selectedMatterId && (
        <div className="bg-white border border-border rounded-xl flex flex-col items-center justify-center py-16 text-secondary">
          <svg className="w-10 h-10 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-medium">Select a matter above to log and view time entries.</p>
        </div>
      )}
    </div>
  );
}
