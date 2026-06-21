'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface IntakeTemplate {
  id: string;
  name: string;
  practice_area: string;
  description: string | null;
  default_fields: Record<string, string>;
  default_tasks: DefaultTask[];
  court_deadlines: CourtDeadlineTemplate[];
  engagement_type: string;
  retainer_tier: string;
  hourly_rate: number | null;
  flat_fee: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface DefaultTask {
  title: string;
  description: string;
  due_days: number;
  priority: 'low' | 'medium' | 'high';
  assigned_role: string;
}

interface CourtDeadlineTemplate {
  title: string;
  deadline_type: string;
  days_from_start: number;
  description: string;
}

interface CaseOption {
  id: string;
  name: string;
  service: string;
}

// ─── Built-in Template Definitions ───────────────────────────────────────────

const BUILT_IN_TEMPLATES: Omit<IntakeTemplate, 'id' | 'created_at' | 'updated_at'>[] = [
  {
    name: 'Family Law — Divorce',
    practice_area: 'Family Law',
    description: 'Comprehensive intake for contested and uncontested divorce proceedings including asset division and custody.',
    engagement_type: 'litigation',
    retainer_tier: 'standard',
    hourly_rate: 350,
    flat_fee: null,
    is_active: true,
    default_fields: {
      matter_type: 'Divorce',
      jurisdiction: '',
      opposing_party: '',
      children_involved: 'No',
      property_division: 'Yes',
      spousal_support: 'TBD',
      filing_county: '',
    },
    default_tasks: [
      { title: 'Gather financial disclosure documents', description: 'Collect bank statements, tax returns, and asset documentation', due_days: 7, priority: 'high', assigned_role: 'paralegal' },
      { title: 'Draft petition for dissolution', description: 'Prepare initial divorce petition with all required attachments', due_days: 14, priority: 'high', assigned_role: 'attorney' },
      { title: 'File petition with court', description: 'File and serve divorce petition on opposing party', due_days: 21, priority: 'high', assigned_role: 'paralegal' },
      { title: 'Schedule mediation session', description: 'Coordinate mediation for asset division and custody', due_days: 30, priority: 'medium', assigned_role: 'attorney' },
      { title: 'Prepare settlement agreement draft', description: 'Draft proposed settlement terms for client review', due_days: 45, priority: 'medium', assigned_role: 'attorney' },
    ],
    court_deadlines: [
      { title: 'Response Deadline', deadline_type: 'filing', days_from_start: 30, description: 'Opposing party response due' },
      { title: 'Discovery Cutoff', deadline_type: 'discovery', days_from_start: 90, description: 'All discovery must be completed' },
      { title: 'Mediation Deadline', deadline_type: 'hearing', days_from_start: 60, description: 'Mandatory mediation session' },
      { title: 'Trial Date', deadline_type: 'trial', days_from_start: 180, description: 'Scheduled trial date if no settlement' },
    ],
  },
  {
    name: 'Family Law — Child Custody',
    practice_area: 'Family Law',
    description: 'Intake template for child custody and visitation disputes, including modification proceedings.',
    engagement_type: 'litigation',
    retainer_tier: 'standard',
    hourly_rate: 350,
    flat_fee: null,
    is_active: true,
    default_fields: {
      matter_type: 'Child Custody',
      number_of_children: '',
      current_custody_arrangement: 'None',
      modification_request: 'No',
      guardian_ad_litem_needed: 'TBD',
      jurisdiction: '',
    },
    default_tasks: [
      { title: 'Collect parenting history documentation', description: 'Gather school records, medical records, and parenting schedule history', due_days: 7, priority: 'high', assigned_role: 'paralegal' },
      { title: 'Draft custody petition', description: 'Prepare petition for custody or modification', due_days: 10, priority: 'high', assigned_role: 'attorney' },
      { title: 'File custody petition', description: 'File and serve custody petition', due_days: 14, priority: 'high', assigned_role: 'paralegal' },
      { title: 'Prepare parenting plan proposal', description: 'Draft detailed parenting plan for client review', due_days: 21, priority: 'high', assigned_role: 'attorney' },
      { title: 'Coordinate guardian ad litem if needed', description: 'Request appointment of guardian ad litem for children', due_days: 30, priority: 'medium', assigned_role: 'attorney' },
    ],
    court_deadlines: [
      { title: 'Temporary Orders Hearing', deadline_type: 'hearing', days_from_start: 21, description: 'Emergency temporary custody hearing' },
      { title: 'Parenting Plan Exchange', deadline_type: 'filing', days_from_start: 45, description: 'Exchange proposed parenting plans' },
      { title: 'Custody Evaluation Deadline', deadline_type: 'discovery', days_from_start: 75, description: 'Custody evaluation report due' },
      { title: 'Final Hearing', deadline_type: 'trial', days_from_start: 120, description: 'Final custody determination hearing' },
    ],
  },
  {
    name: 'Civil Litigation — General',
    practice_area: 'Litigation',
    description: 'Standard civil litigation intake for breach of contract, tort claims, and general civil disputes.',
    engagement_type: 'litigation',
    retainer_tier: 'premium',
    hourly_rate: 400,
    flat_fee: null,
    is_active: true,
    default_fields: {
      matter_type: 'Civil Litigation',
      claim_type: '',
      damages_amount: '',
      statute_of_limitations: '',
      opposing_counsel: '',
      court_jurisdiction: '',
      case_number: '',
    },
    default_tasks: [
      { title: 'Conduct initial case assessment', description: 'Review facts, identify claims, assess damages and liability', due_days: 5, priority: 'high', assigned_role: 'attorney' },
      { title: 'Draft and file complaint', description: 'Prepare complaint with all causes of action and file with court', due_days: 14, priority: 'high', assigned_role: 'attorney' },
      { title: 'Serve defendant', description: 'Arrange service of process on all defendants', due_days: 21, priority: 'high', assigned_role: 'paralegal' },
      { title: 'Prepare initial discovery requests', description: 'Draft interrogatories, requests for production, and admissions', due_days: 45, priority: 'medium', assigned_role: 'attorney' },
      { title: 'Schedule depositions', description: 'Notice and schedule key witness depositions', due_days: 60, priority: 'medium', assigned_role: 'paralegal' },
      { title: 'Prepare summary judgment motion', description: 'Research and draft motion for summary judgment if applicable', due_days: 90, priority: 'medium', assigned_role: 'attorney' },
    ],
    court_deadlines: [
      { title: 'Answer Deadline', deadline_type: 'filing', days_from_start: 30, description: 'Defendant answer to complaint due' },
      { title: 'Discovery Opens', deadline_type: 'discovery', days_from_start: 35, description: 'Discovery period begins' },
      { title: 'Discovery Cutoff', deadline_type: 'discovery', days_from_start: 150, description: 'All discovery must be completed' },
      { title: 'Dispositive Motion Deadline', deadline_type: 'filing', days_from_start: 180, description: 'Summary judgment motions due' },
      { title: 'Pre-Trial Conference', deadline_type: 'hearing', days_from_start: 210, description: 'Pre-trial conference with judge' },
      { title: 'Trial Date', deadline_type: 'trial', days_from_start: 270, description: 'Scheduled trial date' },
    ],
  },
  {
    name: 'Contract Review — Business',
    practice_area: 'Contract Review',
    description: 'Intake template for business contract review, negotiation, and drafting engagements.',
    engagement_type: 'flat_fee',
    retainer_tier: 'basic',
    hourly_rate: null,
    flat_fee: 1500,
    is_active: true,
    default_fields: {
      matter_type: 'Contract Review',
      contract_type: '',
      contract_value: '',
      counterparty: '',
      governing_law: 'Louisiana',
      review_scope: 'Full Review',
      turnaround_requested: '5 business days',
    },
    default_tasks: [
      { title: 'Receive and log contract documents', description: 'Confirm receipt of all contract documents from client', due_days: 1, priority: 'high', assigned_role: 'paralegal' },
      { title: 'Initial contract review', description: 'Review contract for key terms, risks, and red flags', due_days: 3, priority: 'high', assigned_role: 'attorney' },
      { title: 'Prepare redline and memo', description: 'Draft redlined contract and summary memo of issues', due_days: 5, priority: 'high', assigned_role: 'attorney' },
      { title: 'Client review call', description: 'Schedule and conduct call to review findings with client', due_days: 7, priority: 'medium', assigned_role: 'attorney' },
      { title: 'Finalize negotiated terms', description: 'Incorporate agreed changes and prepare final version', due_days: 10, priority: 'medium', assigned_role: 'attorney' },
    ],
    court_deadlines: [
      { title: 'Contract Execution Deadline', deadline_type: 'filing', days_from_start: 14, description: 'Target date for contract execution' },
    ],
  },
  {
    name: 'Estate Planning — Will & Trust',
    practice_area: 'Estate Planning',
    description: 'Intake for comprehensive estate planning including last will, living trust, and powers of attorney.',
    engagement_type: 'flat_fee',
    retainer_tier: 'basic',
    hourly_rate: null,
    flat_fee: 2500,
    is_active: true,
    default_fields: {
      matter_type: 'Estate Planning',
      marital_status: '',
      number_of_children: '',
      estimated_estate_value: '',
      existing_documents: 'None',
      trust_needed: 'TBD',
      healthcare_directive: 'Yes',
    },
    default_tasks: [
      { title: 'Complete estate planning questionnaire', description: 'Send and collect completed estate planning intake questionnaire', due_days: 5, priority: 'high', assigned_role: 'paralegal' },
      { title: 'Draft last will and testament', description: 'Prepare will with all bequests, executor designation, and guardianship', due_days: 14, priority: 'high', assigned_role: 'attorney' },
      { title: 'Draft trust documents if applicable', description: 'Prepare revocable living trust and pour-over will', due_days: 14, priority: 'high', assigned_role: 'attorney' },
      { title: 'Draft powers of attorney', description: 'Prepare financial and healthcare powers of attorney', due_days: 14, priority: 'medium', assigned_role: 'attorney' },
      { title: 'Schedule signing ceremony', description: 'Coordinate notarized signing of all estate documents', due_days: 21, priority: 'high', assigned_role: 'paralegal' },
    ],
    court_deadlines: [],
  },
  {
    name: 'Real Estate — Transaction',
    practice_area: 'Real Estate',
    description: 'Intake for residential and commercial real estate purchase, sale, and closing transactions.',
    engagement_type: 'flat_fee',
    retainer_tier: 'basic',
    hourly_rate: null,
    flat_fee: 1200,
    is_active: true,
    default_fields: {
      matter_type: 'Real Estate Transaction',
      transaction_type: 'Purchase',
      property_address: '',
      purchase_price: '',
      closing_date: '',
      lender: '',
      title_company: '',
    },
    default_tasks: [
      { title: 'Review purchase agreement', description: 'Review and advise on purchase/sale agreement terms', due_days: 2, priority: 'high', assigned_role: 'attorney' },
      { title: 'Title search and review', description: 'Order and review title search for encumbrances', due_days: 7, priority: 'high', assigned_role: 'paralegal' },
      { title: 'Review loan documents', description: 'Review mortgage and loan documents for client', due_days: 10, priority: 'high', assigned_role: 'attorney' },
      { title: 'Prepare closing documents', description: 'Prepare deed, settlement statement, and closing documents', due_days: 14, priority: 'high', assigned_role: 'attorney' },
      { title: 'Attend and coordinate closing', description: 'Attend closing and ensure all documents are properly executed', due_days: 21, priority: 'high', assigned_role: 'attorney' },
    ],
    court_deadlines: [
      { title: 'Inspection Deadline', deadline_type: 'filing', days_from_start: 10, description: 'Property inspection contingency deadline' },
      { title: 'Financing Contingency', deadline_type: 'filing', days_from_start: 21, description: 'Loan approval contingency deadline' },
      { title: 'Closing Date', deadline_type: 'hearing', days_from_start: 30, description: 'Scheduled closing date' },
    ],
  },
];

const PRACTICE_AREA_COLORS: Record<string, string> = {
  'Family Law': 'bg-purple-100 text-purple-700 border-purple-200',
  'Litigation': 'bg-red-100 text-red-700 border-red-200',
  'Contract Review': 'bg-blue-100 text-blue-700 border-blue-200',
  'Estate Planning': 'bg-amber-100 text-amber-700 border-amber-200',
  'Real Estate': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Criminal Defense': 'bg-gray-100 text-gray-700 border-gray-200',
  'Business Law': 'bg-indigo-100 text-indigo-700 border-indigo-200',
};

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-green-100 text-green-700',
};

const DEADLINE_TYPE_COLORS: Record<string, string> = {
  filing: 'bg-blue-100 text-blue-700',
  hearing: 'bg-purple-100 text-purple-700',
  discovery: 'bg-amber-100 text-amber-700',
  trial: 'bg-red-100 text-red-700',
  sol: 'bg-gray-100 text-gray-700',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function IntakeTemplatesDashboard() {
  const supabase = createClient();

  const [templates, setTemplates] = useState<IntakeTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<IntakeTemplate | null>(null);
  const [activeView, setActiveView] = useState<'list' | 'detail' | 'apply'>('list');
  const [filterArea, setFilterArea] = useState<string>('all');
  const [cases, setCases] = useState<CaseOption[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [applyLoading, setApplyLoading] = useState(false);
  const [applySuccess, setApplySuccess] = useState('');
  const [applyError, setApplyError] = useState('');
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    practice_area: 'Family Law',
    description: '',
    engagement_type: 'litigation',
    retainer_tier: 'standard',
    hourly_rate: '',
    flat_fee: '',
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('intake_templates')
      .select('*')
      .order('practice_area', { ascending: true });
    setTemplates(data || []);
    setLoading(false);
  }, [supabase]);

  const loadCases = useCallback(async () => {
    const { data } = await supabase
      .from('contact_inquiries')
      .select('id, name, service')
      .in('status', ['new', 'in_review', 'contacted'])
      .order('created_at', { ascending: false })
      .limit(50);
    setCases(data || []);
  }, [supabase]);

  useEffect(() => {
    loadTemplates();
    loadCases();
  }, [loadTemplates, loadCases]);

  const handleSeedBuiltIn = async () => {
    setSeedLoading(true);
    setSeedSuccess('');
    try {
      for (const t of BUILT_IN_TEMPLATES) {
        await supabase.from('intake_templates').upsert({
          ...t,
          default_fields: t.default_fields,
          default_tasks: t.default_tasks,
          court_deadlines: t.court_deadlines,
        }, { onConflict: 'name' });
      }
      setSeedSuccess(`${BUILT_IN_TEMPLATES.length} built-in templates loaded successfully.`);
      loadTemplates();
    } catch {
      setSeedSuccess('Error loading templates. Please try again.');
    }
    setSeedLoading(false);
  };

  const handleApplyTemplate = async () => {
    if (!selectedTemplate || !selectedCaseId) return;
    setApplyLoading(true);
    setApplyError('');
    setApplySuccess('');

    try {
      const caseRecord = cases.find((c) => c.id === selectedCaseId);
      const startDate = new Date();

      // Create tasks from template
      const taskInserts = selectedTemplate.default_tasks.map((task) => {
        const dueDate = new Date(startDate);
        dueDate.setDate(dueDate.getDate() + task.due_days);
        return {
          inquiry_id: selectedCaseId,
          title: task.title,
          description: task.description,
          due_date: dueDate.toISOString().split('T')[0],
          priority: task.priority,
          status: 'pending',
          assigned_to: task.assigned_role,
          source: 'intake_template',
          template_id: selectedTemplate.id,
        };
      });

      if (taskInserts.length > 0) {
        await supabase.from('admin_tasks').insert(taskInserts);
      }

      // Create court deadlines from template
      const deadlineInserts = selectedTemplate.court_deadlines.map((dl) => {
        const deadlineDate = new Date(startDate);
        deadlineDate.setDate(deadlineDate.getDate() + dl.days_from_start);
        return {
          inquiry_id: selectedCaseId,
          title: dl.title,
          deadline_type: dl.deadline_type,
          deadline_date: deadlineDate.toISOString().split('T')[0],
          description: dl.description,
          status: 'upcoming',
          source: 'intake_template',
          template_id: selectedTemplate.id,
        };
      });

      if (deadlineInserts.length > 0) {
        await supabase.from('court_deadlines').insert(deadlineInserts);
      }

      // Log template application
      await supabase.from('intake_template_applications').insert({
        template_id: selectedTemplate.id,
        inquiry_id: selectedCaseId,
        applied_at: new Date().toISOString(),
        tasks_created: taskInserts.length,
        deadlines_created: deadlineInserts.length,
      }).select();

      setApplySuccess(
        `Template applied to "${caseRecord?.name || 'case'}" — ${taskInserts.length} tasks and ${deadlineInserts.length} court deadlines created.`
      );
      setSelectedCaseId('');
    } catch (err) {
      setApplyError('Failed to apply template. Please check that the case exists and try again.');
    }
    setApplyLoading(false);
  };

  const handleCreateTemplate = async () => {
    if (!newTemplate.name || !newTemplate.practice_area) {
      setCreateError('Name and practice area are required.');
      return;
    }
    setCreateLoading(true);
    setCreateError('');
    const { error } = await supabase.from('intake_templates').insert({
      name: newTemplate.name,
      practice_area: newTemplate.practice_area,
      description: newTemplate.description || null,
      engagement_type: newTemplate.engagement_type,
      retainer_tier: newTemplate.retainer_tier,
      hourly_rate: newTemplate.hourly_rate ? parseFloat(newTemplate.hourly_rate) : null,
      flat_fee: newTemplate.flat_fee ? parseFloat(newTemplate.flat_fee) : null,
      default_fields: {},
      default_tasks: [],
      court_deadlines: [],
      is_active: true,
    });
    if (error) {
      setCreateError(error.message);
    } else {
      setShowCreateModal(false);
      setNewTemplate({ name: '', practice_area: 'Family Law', description: '', engagement_type: 'litigation', retainer_tier: 'standard', hourly_rate: '', flat_fee: '' });
      loadTemplates();
    }
    setCreateLoading(false);
  };

  const handleToggleActive = async (id: string, current: boolean) => {
    await supabase.from('intake_templates').update({ is_active: !current }).eq('id', id);
    loadTemplates();
  };

  const practiceAreas = ['all', ...Array.from(new Set(templates.map((t) => t.practice_area)))];
  const filtered = filterArea === 'all' ? templates : templates.filter((t) => t.practice_area === filterArea);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin text-primary mr-3">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
        <span className="text-muted-foreground text-sm">Loading intake templates…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {practiceAreas.map((area) => (
            <button
              key={area}
              onClick={() => setFilterArea(area)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                filterArea === area
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-transparent border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
              }`}
            >
              {area === 'all' ? 'All Areas' : area}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {templates.length === 0 && (
            <button
              onClick={handleSeedBuiltIn}
              disabled={seedLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-60"
              style={{ background: '#355E3B', color: '#fff' }}
            >
              {seedLoading ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
              )}
              Load Built-in Templates
            </button>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-widest border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            New Template
          </button>
        </div>
      </div>

      {seedSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700">{seedSuccess}</div>
      )}

      {/* Empty State */}
      {filtered.length === 0 && (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-secondary/60 flex items-center justify-center mx-auto mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <p className="font-serif text-lg text-foreground mb-1">No templates yet</p>
          <p className="text-sm text-muted-foreground mb-4">Load the built-in templates to get started with family law, litigation, contract review, and more.</p>
          <button
            onClick={handleSeedBuiltIn}
            disabled={seedLoading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-60"
            style={{ background: '#355E3B', color: '#fff' }}
          >
            {seedLoading ? 'Loading…' : 'Load Built-in Templates'}
          </button>
        </div>
      )}

      {/* Template Grid */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((template) => (
            <div
              key={template.id}
              className={`bg-card border rounded-2xl p-5 flex flex-col gap-3 transition-all hover:shadow-sm ${
                template.is_active ? 'border-border' : 'border-border/40 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border mb-2 ${PRACTICE_AREA_COLORS[template.practice_area] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                    {template.practice_area}
                  </span>
                  <h3 className="font-serif text-base text-foreground leading-snug">{template.name}</h3>
                  {template.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{template.description}</p>
                  )}
                </div>
                <button
                  onClick={() => handleToggleActive(template.id, template.is_active)}
                  className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    template.is_active ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-secondary/40 text-muted-foreground hover:bg-secondary/60'
                  }`}
                  title={template.is_active ? 'Deactivate' : 'Activate'}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    {template.is_active ? <><path d="M20 6 9 17l-5-5"/></> : <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>}
                  </svg>
                </button>
              </div>

              {/* Stats Row */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                  </svg>
                  {template.default_tasks.length} tasks
                </span>
                <span className="flex items-center gap-1">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  {template.court_deadlines.length} deadlines
                </span>
                {template.hourly_rate && (
                  <span className="flex items-center gap-1">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                    </svg>
                    ${template.hourly_rate}/hr
                  </span>
                )}
                {template.flat_fee && (
                  <span className="flex items-center gap-1">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                    </svg>
                    ${template.flat_fee?.toLocaleString()} flat
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-auto pt-2 border-t border-border/50">
                <button
                  onClick={() => { setSelectedTemplate(template); setActiveView('detail'); }}
                  className="flex-1 py-1.5 rounded-lg text-xs font-semibold border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
                >
                  View Details
                </button>
                <button
                  onClick={() => { setSelectedTemplate(template); setActiveView('apply'); setApplySuccess(''); setApplyError(''); }}
                  disabled={!template.is_active}
                  className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90 disabled:opacity-40"
                  style={{ background: '#355E3B', color: '#fff' }}
                >
                  Apply to Case
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {activeView === 'detail' && selectedTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between">
              <div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border mb-1 ${PRACTICE_AREA_COLORS[selectedTemplate.practice_area] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                  {selectedTemplate.practice_area}
                </span>
                <h2 className="font-serif text-xl text-foreground">{selectedTemplate.name}</h2>
              </div>
              <button onClick={() => setActiveView('list')} className="text-muted-foreground/50 hover:text-foreground transition-colors p-1">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-6">
              {selectedTemplate.description && (
                <p className="text-sm text-muted-foreground">{selectedTemplate.description}</p>
              )}

              {/* Auto-populated Fields */}
              {Object.keys(selectedTemplate.default_fields).length > 0 && (
                <div>
                  <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">Auto-Populated Fields</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(selectedTemplate.default_fields).map(([key, val]) => (
                      <div key={key} className="bg-secondary/30 rounded-xl px-3 py-2">
                        <p className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</p>
                        <p className="text-sm font-medium text-foreground">{val || '—'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Default Tasks */}
              {selectedTemplate.default_tasks.length > 0 && (
                <div>
                  <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">Default Tasks ({selectedTemplate.default_tasks.length})</h3>
                  <div className="space-y-2">
                    {selectedTemplate.default_tasks.map((task, i) => (
                      <div key={i} className="bg-secondary/20 border border-border/50 rounded-xl px-4 py-3 flex items-start gap-3">
                        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-foreground">{task.title}</p>
                            <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${PRIORITY_COLORS[task.priority]}`}>{task.priority}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>
                          <p className="text-xs text-muted-foreground/70 mt-1">Due: Day {task.due_days} · Assigned: {task.assigned_role}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Court Deadlines */}
              {selectedTemplate.court_deadlines.length > 0 && (
                <div>
                  <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">Linked Court Deadlines ({selectedTemplate.court_deadlines.length})</h3>
                  <div className="space-y-2">
                    {selectedTemplate.court_deadlines.map((dl, i) => (
                      <div key={i} className="bg-secondary/20 border border-border/50 rounded-xl px-4 py-3 flex items-start gap-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold flex-shrink-0 mt-0.5 ${DEADLINE_TYPE_COLORS[dl.deadline_type] || 'bg-gray-100 text-gray-700'}`}>
                          {dl.deadline_type}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{dl.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{dl.description}</p>
                          <p className="text-xs text-muted-foreground/70 mt-1">Day {dl.days_from_start} from case start</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setActiveView('list')}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-border text-muted-foreground hover:text-foreground transition-all"
                >
                  Back
                </button>
                <button
                  onClick={() => { setActiveView('apply'); setApplySuccess(''); setApplyError(''); }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
                  style={{ background: '#355E3B', color: '#fff' }}
                >
                  Apply to Case
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Apply Modal */}
      {activeView === 'apply' && selectedTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-xl">
            <div className="border-b border-border px-6 py-4 flex items-center justify-between">
              <h2 className="font-serif text-lg text-foreground">Apply Template to Case</h2>
              <button onClick={() => setActiveView('list')} className="text-muted-foreground/50 hover:text-foreground transition-colors p-1">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-secondary/30 rounded-xl px-4 py-3">
                <p className="text-xs text-muted-foreground mb-0.5">Template</p>
                <p className="text-sm font-semibold text-foreground">{selectedTemplate.name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Will create {selectedTemplate.default_tasks.length} tasks and {selectedTemplate.court_deadlines.length} court deadlines
                </p>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Select Case</label>
                <select
                  value={selectedCaseId}
                  onChange={(e) => setSelectedCaseId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
                >
                  <option value="">Choose a case…</option>
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} — {c.service}</option>
                  ))}
                </select>
              </div>

              {applyError && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{applyError}</div>
              )}
              {applySuccess && (
                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700">{applySuccess}</div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setActiveView('list')}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-border text-muted-foreground hover:text-foreground transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApplyTemplate}
                  disabled={!selectedCaseId || applyLoading}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: '#355E3B', color: '#fff' }}
                >
                  {applyLoading ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                      </svg>
                      Applying…
                    </>
                  ) : 'Apply Template'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Template Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-xl">
            <div className="border-b border-border px-6 py-4 flex items-center justify-between">
              <h2 className="font-serif text-lg text-foreground">New Intake Template</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-muted-foreground/50 hover:text-foreground transition-colors p-1">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">Template Name *</label>
                <input
                  type="text"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Family Law — Adoption"
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">Practice Area *</label>
                <select
                  value={newTemplate.practice_area}
                  onChange={(e) => setNewTemplate((p) => ({ ...p, practice_area: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
                >
                  {['Family Law', 'Litigation', 'Contract Review', 'Estate Planning', 'Real Estate', 'Criminal Defense', 'Business Law', 'Other'].map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">Description</label>
                <textarea
                  rows={2}
                  value={newTemplate.description}
                  onChange={(e) => setNewTemplate((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Brief description of this template…"
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">Engagement Type</label>
                  <select
                    value={newTemplate.engagement_type}
                    onChange={(e) => setNewTemplate((p) => ({ ...p, engagement_type: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all"
                  >
                    <option value="litigation">Litigation</option>
                    <option value="flat_fee">Flat Fee</option>
                    <option value="retainer">Retainer</option>
                    <option value="consultation">Consultation</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">Hourly Rate ($)</label>
                  <input
                    type="number"
                    value={newTemplate.hourly_rate}
                    onChange={(e) => setNewTemplate((p) => ({ ...p, hourly_rate: e.target.value }))}
                    placeholder="350"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all"
                  />
                </div>
              </div>

              {createError && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{createError}</div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-border text-muted-foreground hover:text-foreground transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateTemplate}
                  disabled={createLoading}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ background: '#355E3B', color: '#fff' }}
                >
                  {createLoading ? 'Creating…' : 'Create Template'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
