'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

type PracticeArea = 'litigation' | 'contracts' | 'discovery';
type TemplateType = 'contract' | 'retainer' | 'discovery';

interface LegalTemplate {
  id: string;
  template_type: TemplateType;
  practice_area: PracticeArea;
  name: string;
  description: string | null;
  body: string;
  variables: string[];
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

interface TemplateFormState {
  name: string;
  description: string;
  practice_area: PracticeArea;
  template_type: TemplateType;
  body: string;
  variables: string[];
  is_default: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRACTICE_AREAS: { id: PracticeArea; label: string; icon: string; color: string; bg: string; border: string; badge: string }[] = [
  {
    id: 'litigation',
    label: 'Litigation',
    icon: '⚖️',
    color: '#b45309',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    badge: 'bg-amber-100 text-amber-800',
  },
  {
    id: 'contracts',
    label: 'Contracts',
    icon: '📋',
    color: '#355E3B',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    badge: 'bg-emerald-100 text-emerald-800',
  },
  {
    id: 'discovery',
    label: 'Discovery',
    icon: '🔍',
    color: '#1d4ed8',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    badge: 'bg-blue-100 text-blue-800',
  },
];

const TEMPLATE_TYPES: { id: TemplateType; label: string }[] = [
  { id: 'contract', label: 'Contract / Agreement' },
  { id: 'retainer', label: 'Retainer' },
  { id: 'discovery', label: 'Discovery Document' },
];

const SUGGESTED_VARIABLES: Record<PracticeArea, string[]> = {
  litigation: [
    '{{clientName}}', '{{clientEmail}}', '{{caseName}}', '{{caseNumber}}',
    '{{courtName}}', '{{judgeAssigned}}', '{{filingDate}}', '{{hearingDate}}',
    '{{opposingCounsel}}', '{{opposingParty}}', '{{reliefSought}}', '{{agreementDate}}',
  ],
  contracts: [
    '{{clientName}}', '{{clientEmail}}', '{{caseName}}', '{{serviceType}}',
    '{{agreementDate}}', '{{retainerAmount}}', '{{includedHours}}', '{{startDate}}',
    '{{firmName}}', '{{contractTerm}}', '{{paymentSchedule}}', '{{governingLaw}}',
  ],
  discovery: [
    '{{clientName}}', '{{clientEmail}}', '{{firmName}}', '{{caseName}}',
    '{{serviceType}}', '{{agreementDate}}', '{{caseNumber}}', '{{responseDeadline}}',
    '{{requestingParty}}', '{{respondingParty}}', '{{discoveryType}}',
  ],
};

const DEFAULT_BODY: Record<PracticeArea, string> = {
  litigation: `MOTION / LITIGATION DOCUMENT

Court: {{courtName}}
Case No.: {{caseNumber}}
Date: {{filingDate}}

IN THE MATTER OF:
{{clientName}} v. {{opposingParty}}

─────────────────────────────────────────
I. INTRODUCTION
─────────────────────────────────────────

This matter involves {{caseName}}. Client {{clientName}} ({{clientEmail}}) seeks the following relief: {{reliefSought}}.

─────────────────────────────────────────
II. STATEMENT OF FACTS
─────────────────────────────────────────

[Insert case facts here]

─────────────────────────────────────────
III. LEGAL ARGUMENT
─────────────────────────────────────────

[Insert legal argument here]

─────────────────────────────────────────
IV. CONCLUSION
─────────────────────────────────────────

For the foregoing reasons, {{clientName}} respectfully requests that this Court grant the relief sought herein.

Respectfully submitted,

_______________________________
Maggi May Broussard, Esq.
Broussard Legal Services
Date: {{filingDate}}`,

  contracts: `LEGAL SERVICES AGREEMENT

This Agreement is entered into as of {{agreementDate}} between Broussard Legal Services ("Firm") and {{clientName}} ("Client").

─────────────────────────────────────────
1. SCOPE OF SERVICES
─────────────────────────────────────────

Matter: {{caseName}}
Service Type: {{serviceType}}

─────────────────────────────────────────
2. FEES AND BILLING
─────────────────────────────────────────

Client agrees to pay the Firm at the agreed rate. Invoices are due within 30 days of receipt.

─────────────────────────────────────────
3. RETAINER
─────────────────────────────────────────

Client shall pay an initial retainer of \${{retainerAmount}} upon execution of this Agreement.

─────────────────────────────────────────
4. TERM
─────────────────────────────────────────

This Agreement commences on {{startDate}} and continues for {{contractTerm}}.

─────────────────────────────────────────
5. GOVERNING LAW
─────────────────────────────────────────

This Agreement shall be governed by the laws of {{governingLaw}}.

IN WITNESS WHEREOF, the parties have executed this Agreement.

_______________________________
Maggi May Broussard, Esq.
Broussard Legal Services

_______________________________
{{clientName}}
Date: {{agreementDate}}`,

  discovery: `DISCOVERY REQUEST

Date: {{agreementDate}}
Case No.: {{caseNumber}}
Requesting Party: {{requestingParty}}
Responding Party: {{respondingParty}}
Discovery Type: {{discoveryType}}

─────────────────────────────────────────
INSTRUCTIONS
─────────────────────────────────────────

Please respond to the following requests within {{responseDeadline}} days of service.

─────────────────────────────────────────
DEFINITIONS
─────────────────────────────────────────

"You" and "Your" refer to {{respondingParty}} and all agents, representatives, and persons acting on their behalf.

─────────────────────────────────────────
REQUESTS
─────────────────────────────────────────

REQUEST NO. 1:
[Insert discovery request]

REQUEST NO. 2:
[Insert discovery request]

REQUEST NO. 3:
[Insert discovery request]

─────────────────────────────────────────
CERTIFICATION
─────────────────────────────────────────

_______________________________
Maggi May Broussard, Esq.
Broussard Legal Services
Date: {{agreementDate}}`,
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function extractVariables(body: string): string[] {
  const matches = body.match(/\{\{[^}]+\}\}/g);
  return matches ? [...new Set(matches)] : [];
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LegalDocumentTemplatesDashboard() {
  const supabase = createClient();

  const [activePracticeArea, setActivePracticeArea] = useState<PracticeArea>('litigation');
  const [templates, setTemplates] = useState<LegalTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal state
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<LegalTemplate | null>(null);
  const [form, setForm] = useState<TemplateFormState>({
    name: '',
    description: '',
    practice_area: 'litigation',
    template_type: 'contract',
    body: '',
    variables: [],
    is_default: false,
  });

  // Variable editor state
  const [newVariable, setNewVariable] = useState('');
  const [showVariablePanel, setShowVariablePanel] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewValues, setPreviewValues] = useState<Record<string, string>>({});

  // Delete confirm
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Data fetching ─────────────────────────────────────────────────────────

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('document_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (err) throw err;

      // Map templates — add practice_area from template_type if not present
      const mapped = (data || []).map((t: Record<string, unknown>) => ({
        ...t,
        practice_area: (t.practice_area as PracticeArea) || mapTypeToPracticeArea(t.template_type as TemplateType),
      })) as LegalTemplate[];

      setTemplates(mapped);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  function mapTypeToPracticeArea(type: TemplateType): PracticeArea {
    if (type === 'discovery') return 'discovery';
    if (type === 'retainer') return 'contracts';
    return 'contracts';
  }

  // ── Filtered templates ────────────────────────────────────────────────────

  const filteredTemplates = templates.filter((t) => t.practice_area === activePracticeArea);

  // ── Form helpers ──────────────────────────────────────────────────────────

  function openNewTemplate() {
    setEditingTemplate(null);
    const area = activePracticeArea;
    setForm({
      name: '',
      description: '',
      practice_area: area,
      template_type: area === 'discovery' ? 'discovery' : 'contract',
      body: DEFAULT_BODY[area],
      variables: extractVariables(DEFAULT_BODY[area]),
      is_default: false,
    });
    setPreviewMode(false);
    setPreviewValues({});
    setShowVariablePanel(true);
    setShowEditor(true);
  }

  function openEditTemplate(t: LegalTemplate) {
    setEditingTemplate(t);
    setForm({
      name: t.name,
      description: t.description || '',
      practice_area: t.practice_area,
      template_type: t.template_type,
      body: t.body,
      variables: t.variables,
      is_default: t.is_default,
    });
    setPreviewMode(false);
    setPreviewValues({});
    setShowVariablePanel(true);
    setShowEditor(true);
  }

  function closeEditor() {
    setShowEditor(false);
    setEditingTemplate(null);
    setNewVariable('');
    setPreviewMode(false);
    setPreviewValues({});
  }

  function handleBodyChange(value: string) {
    const detected = extractVariables(value);
    setForm((prev) => ({
      ...prev,
      body: value,
      variables: [...new Set([...prev.variables, ...detected])],
    }));
  }

  function addVariable(v: string) {
    const clean = v.trim();
    if (!clean) return;
    const formatted = clean.startsWith('{{') ? clean : `{{${clean.replace(/[{}]/g, '')}}}`;
    setForm((prev) => ({
      ...prev,
      variables: prev.variables.includes(formatted) ? prev.variables : [...prev.variables, formatted],
    }));
    setNewVariable('');
  }

  function removeVariable(v: string) {
    setForm((prev) => ({ ...prev, variables: prev.variables.filter((x) => x !== v) }));
  }

  function insertVariableIntoBody(v: string) {
    setForm((prev) => ({ ...prev, body: prev.body + v }));
  }

  function syncVariablesFromBody() {
    const detected = extractVariables(form.body);
    setForm((prev) => ({ ...prev, variables: [...new Set([...prev.variables, ...detected])] }));
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!form.name.trim()) { setError('Template name is required.'); return; }
    if (!form.body.trim()) { setError('Template body is required.'); return; }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        template_type: form.template_type,
        practice_area: form.practice_area,
        name: form.name.trim(),
        description: form.description.trim() || null,
        body: form.body,
        variables: form.variables,
        is_default: form.is_default,
      };

      if (editingTemplate) {
        const { error: err } = await supabase
          .from('document_templates')
          .update(payload)
          .eq('id', editingTemplate.id);
        if (err) throw err;
        setSuccessMsg('Template updated successfully.');
      } else {
        const { error: err } = await supabase
          .from('document_templates')
          .insert(payload);
        if (err) throw err;
        setSuccessMsg('Template created successfully.');
      }

      await fetchTemplates();
      closeEditor();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save template');
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    setSaving(true);
    setError(null);
    try {
      const { error: err } = await supabase.from('document_templates').delete().eq('id', id);
      if (err) throw err;
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      setSuccessMsg('Template deleted.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete template');
    } finally {
      setSaving(false);
      setDeletingId(null);
    }
  }

  // ── Preview ───────────────────────────────────────────────────────────────

  function buildPreview() {
    let text = form.body;
    Object.entries(previewValues).forEach(([k, v]) => {
      text = text.replaceAll(k, v || k);
    });
    return text;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const areaConfig = PRACTICE_AREAS.find((a) => a.id === activePracticeArea)!;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Legal Document Templates</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Create and manage reusable templates per practice area. Lexi uses these when auto-drafting documents.
          </p>
        </div>
        <button
          onClick={openNewTemplate}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 active:scale-95"
          style={{ backgroundColor: '#355E3B' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New Template
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          {successMsg}
        </div>
      )}

      {/* Practice Area Tabs */}
      <div className="flex gap-2 flex-wrap">
        {PRACTICE_AREAS.map((area) => {
          const count = templates.filter((t) => t.practice_area === area.id).length;
          const isActive = activePracticeArea === area.id;
          return (
            <button
              key={area.id}
              onClick={() => setActivePracticeArea(area.id)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                isActive
                  ? `${area.bg} ${area.border} font-semibold`
                  : 'bg-white border-border text-muted-foreground hover:bg-muted/40'
              }`}
              style={isActive ? { color: area.color } : {}}
            >
              <span>{area.icon}</span>
              {area.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${isActive ? area.badge : 'bg-muted text-muted-foreground'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Template Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-border border-t-foreground rounded-full animate-spin" />
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-xl bg-muted/20">
          <span className="text-4xl mb-3">{areaConfig.icon}</span>
          <p className="text-sm font-medium text-foreground">No {areaConfig.label} templates yet</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">Create your first template for Lexi to use when drafting {areaConfig.label.toLowerCase()} documents.</p>
          <button
            onClick={openNewTemplate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
            style={{ backgroundColor: '#355E3B' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Create Template
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTemplates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              areaConfig={areaConfig}
              onEdit={() => openEditTemplate(t)}
              onDelete={() => setDeletingId(t.id)}
            />
          ))}
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl border border-border p-6 max-w-sm w-full">
            <h3 className="text-base font-bold text-foreground mb-2">Delete Template?</h3>
            <p className="text-sm text-muted-foreground mb-5">This action cannot be undone. Lexi will no longer have access to this template.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeletingId(null)} className="px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-muted/40 transition-colors">
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deletingId)}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Editor Modal */}
      {showEditor && (
        <TemplateEditorModal
          form={form}
          setForm={setForm}
          editingTemplate={editingTemplate}
          saving={saving}
          error={error}
          newVariable={newVariable}
          setNewVariable={setNewVariable}
          showVariablePanel={showVariablePanel}
          setShowVariablePanel={setShowVariablePanel}
          previewMode={previewMode}
          setPreviewMode={setPreviewMode}
          previewValues={previewValues}
          setPreviewValues={setPreviewValues}
          onBodyChange={handleBodyChange}
          onAddVariable={addVariable}
          onRemoveVariable={removeVariable}
          onInsertVariable={insertVariableIntoBody}
          onSyncVariables={syncVariablesFromBody}
          onSave={handleSave}
          onClose={closeEditor}
          buildPreview={buildPreview}
        />
      )}
    </div>
  );
}

// ─── Template Card ────────────────────────────────────────────────────────────

interface TemplateCardProps {
  template: LegalTemplate;
  areaConfig: typeof PRACTICE_AREAS[0];
  onEdit: () => void;
  onDelete: () => void;
}

function TemplateCard({ template, areaConfig, onEdit, onDelete }: TemplateCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`rounded-xl border ${areaConfig.border} bg-white shadow-sm hover:shadow-md transition-shadow`}>
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-semibold text-foreground truncate">{template.name}</span>
              {template.is_default && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium shrink-0">Default</span>
              )}
            </div>
            {template.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{template.description}</p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onEdit}
              className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
              title="Edit template"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
              title="Delete template"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${areaConfig.badge}`}>
            {areaConfig.icon} {areaConfig.label}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
            {TEMPLATE_TYPES.find((tt) => tt.id === template.template_type)?.label ?? template.template_type}
          </span>
          <span className="text-xs text-muted-foreground ml-auto">{fmtDate(template.updated_at)}</span>
        </div>

        {/* Variables */}
        {template.variables.length > 0 && (
          <div className="mb-3">
            <p className="text-xs font-medium text-muted-foreground mb-1.5">
              {template.variables.length} placeholder variable{template.variables.length !== 1 ? 's' : ''}
            </p>
            <div className="flex flex-wrap gap-1">
              {template.variables.slice(0, expanded ? undefined : 6).map((v) => (
                <span key={v} className="text-xs px-2 py-0.5 rounded-md bg-muted/60 text-foreground font-mono border border-border/60">
                  {v}
                </span>
              ))}
              {!expanded && template.variables.length > 6 && (
                <button
                  onClick={() => setExpanded(true)}
                  className="text-xs px-2 py-0.5 rounded-md bg-muted/40 text-muted-foreground hover:text-foreground border border-border/40 transition-colors"
                >
                  +{template.variables.length - 6} more
                </button>
              )}
            </div>
          </div>
        )}

        {/* Body preview */}
        <div className="rounded-lg bg-muted/30 border border-border/40 p-2.5">
          <p className="text-xs font-mono text-muted-foreground line-clamp-3 whitespace-pre-wrap leading-relaxed">
            {template.body.slice(0, 200)}{template.body.length > 200 ? '…' : ''}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Template Editor Modal ────────────────────────────────────────────────────

interface EditorProps {
  form: TemplateFormState;
  setForm: React.Dispatch<React.SetStateAction<TemplateFormState>>;
  editingTemplate: LegalTemplate | null;
  saving: boolean;
  error: string | null;
  newVariable: string;
  setNewVariable: (v: string) => void;
  showVariablePanel: boolean;
  setShowVariablePanel: (v: boolean) => void;
  previewMode: boolean;
  setPreviewMode: (v: boolean) => void;
  previewValues: Record<string, string>;
  setPreviewValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onBodyChange: (v: string) => void;
  onAddVariable: (v: string) => void;
  onRemoveVariable: (v: string) => void;
  onInsertVariable: (v: string) => void;
  onSyncVariables: () => void;
  onSave: () => void;
  onClose: () => void;
  buildPreview: () => string;
}

function TemplateEditorModal({
  form, setForm, editingTemplate, saving, error,
  newVariable, setNewVariable,
  showVariablePanel, setShowVariablePanel,
  previewMode, setPreviewMode,
  previewValues, setPreviewValues,
  onBodyChange, onAddVariable, onRemoveVariable, onInsertVariable, onSyncVariables,
  onSave, onClose, buildPreview,
}: EditorProps) {
  const areaConfig = PRACTICE_AREAS.find((a) => a.id === form.practice_area)!;
  const suggested = SUGGESTED_VARIABLES[form.practice_area].filter((v) => !form.variables.includes(v));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-border w-full max-w-5xl my-6">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h3 className="text-base font-bold text-foreground">
              {editingTemplate ? 'Edit Template' : 'New Legal Document Template'}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Define the template body and placeholder variables Lexi will fill in when auto-drafting.
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted/60 text-muted-foreground transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="flex flex-col lg:flex-row">
          {/* Left: Form fields */}
          <div className="flex-1 p-6 space-y-4 border-r border-border/60">
            {/* Name */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">Template Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Standard Motion to Dismiss"
                className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">Description</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Brief description of when to use this template"
                className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
            </div>

            {/* Practice Area + Type row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">Practice Area *</label>
                <select
                  value={form.practice_area}
                  onChange={(e) => {
                    const area = e.target.value as PracticeArea;
                    setForm((p) => ({
                      ...p,
                      practice_area: area,
                      template_type: area === 'discovery' ? 'discovery' : 'contract',
                      body: p.body || DEFAULT_BODY[area],
                      variables: p.variables.length ? p.variables : extractVariables(DEFAULT_BODY[area]),
                    }));
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                >
                  {PRACTICE_AREAS.map((a) => (
                    <option key={a.id} value={a.id}>{a.icon} {a.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">Document Type *</label>
                <select
                  value={form.template_type}
                  onChange={(e) => setForm((p) => ({ ...p, template_type: e.target.value as TemplateType }))}
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                >
                  {TEMPLATE_TYPES.map((tt) => (
                    <option key={tt.id} value={tt.id}>{tt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Default toggle */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, is_default: !p.is_default }))}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.is_default ? 'bg-emerald-600' : 'bg-muted'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${form.is_default ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
              <span className="text-xs text-foreground font-medium">Mark as default template for this practice area</span>
            </div>

            {/* Body editor */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-foreground">Template Body *</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onSyncVariables}
                    className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                  >
                    Sync variables from body
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode(!previewMode)}
                    className={`text-xs px-2 py-0.5 rounded-md border transition-colors ${previewMode ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'border-border text-muted-foreground hover:text-foreground'}`}
                  >
                    {previewMode ? '✏️ Edit' : '👁 Preview'}
                  </button>
                </div>
              </div>
              {previewMode ? (
                <div className="w-full min-h-[320px] px-3 py-2.5 rounded-lg border border-border bg-muted/20 text-xs font-mono text-foreground whitespace-pre-wrap leading-relaxed overflow-auto">
                  {buildPreview()}
                </div>
              ) : (
                <textarea
                  value={form.body}
                  onChange={(e) => onBodyChange(e.target.value)}
                  rows={16}
                  placeholder="Write your template here. Use {{variableName}} for placeholders that Lexi will fill in."
                  className="w-full px-3 py-2.5 rounded-lg border border-border text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 resize-y leading-relaxed"
                />
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Use <code className="bg-muted px-1 rounded text-xs">{'{{variableName}}'}</code> syntax for placeholders. Lexi will replace them with case/client data.
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">{error}</div>
            )}
          </div>

          {/* Right: Variable Panel */}
          <div className="w-full lg:w-72 p-5 space-y-4 bg-muted/20">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">Placeholder Variables</h4>
              <button
                onClick={() => setShowVariablePanel(!showVariablePanel)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {showVariablePanel ? 'Hide' : 'Show'}
              </button>
            </div>

            {showVariablePanel && (
              <>
                {/* Active variables */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Active ({form.variables.length})</p>
                  {form.variables.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No variables yet. Add them below or use {'{{syntax}}'} in the body.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {form.variables.map((v) => (
                        <div key={v} className="flex items-center gap-1.5 group">
                          <button
                            onClick={() => onInsertVariable(v)}
                            className="flex-1 text-left text-xs px-2 py-1 rounded-md bg-white border border-border font-mono hover:bg-emerald-50 hover:border-emerald-300 transition-colors truncate"
                            title="Click to insert into body"
                          >
                            {v}
                          </button>
                          <button
                            onClick={() => onRemoveVariable(v)}
                            className="p-1 rounded text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add custom variable */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">Add Variable</p>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={newVariable}
                      onChange={(e) => setNewVariable(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onAddVariable(newVariable); } }}
                      placeholder="variableName"
                      className="flex-1 px-2 py-1.5 rounded-lg border border-border text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                    />
                    <button
                      onClick={() => onAddVariable(newVariable)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors"
                      style={{ backgroundColor: '#355E3B' }}
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Suggested variables */}
                {suggested.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">
                      Suggested for {areaConfig.label}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {suggested.map((v) => (
                        <button
                          key={v}
                          onClick={() => onAddVariable(v)}
                          className="text-xs px-1.5 py-0.5 rounded-md bg-white border border-border font-mono hover:bg-emerald-50 hover:border-emerald-300 transition-colors"
                        >
                          + {v}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Preview fill-in */}
                {previewMode && form.variables.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Preview Values</p>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {form.variables.map((v) => (
                        <div key={v}>
                          <label className="text-xs text-muted-foreground font-mono">{v}</label>
                          <input
                            type="text"
                            value={previewValues[v] || ''}
                            onChange={(e) => setPreviewValues((p) => ({ ...p, [v]: e.target.value }))}
                            placeholder="preview value"
                            className="w-full mt-0.5 px-2 py-1 rounded-md border border-border text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/20 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-muted/40 transition-colors">
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#355E3B' }}
          >
            {saving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
                </svg>
                {editingTemplate ? 'Save Changes' : 'Create Template'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
