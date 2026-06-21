'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

type TemplateType = 'contract' | 'retainer' | 'discovery';

interface DocumentTemplate {
  id: string;
  template_type: TemplateType;
  name: string;
  description: string | null;
  body: string;
  variables: string[];
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

interface CaseOption {
  id: string;
  name: string;
  email: string;
  firm: string;
  service: string;
}

interface PopulatedDoc {
  templateId: string;
  templateName: string;
  body: string;
  caseId: string;
  clientName: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENT = '#355E3B';

const TYPE_META: Record<TemplateType, { label: string; color: string; bg: string; border: string; badge: string; icon: React.ReactNode }> = {
  contract: {
    label: 'Contract',
    color: '#355E3B',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    badge: 'bg-emerald-100 text-emerald-700',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
  },
  retainer: {
    label: 'Retainer',
    color: '#7c3aed',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    badge: 'bg-violet-100 text-violet-700',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
    ),
  },
  discovery: {
    label: 'Discovery',
    color: '#d97706',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    badge: 'bg-amber-100 text-amber-700',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    ),
  },
};

const VARIABLE_HINTS: Record<string, string> = {
  '{{clientName}}': 'Full name of the client',
  '{{clientEmail}}': 'Client email address',
  '{{firmName}}': 'Client firm or organization',
  '{{caseName}}': 'Case / matter name',
  '{{serviceType}}': 'Type of legal service',
  '{{agreementDate}}': 'Date of agreement (today)',
  '{{retainerAmount}}': 'Retainer fee amount',
  '{{includedHours}}': 'Hours included in retainer',
  '{{startDate}}': 'Retainer start date',
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function todayStr() {
  return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function populateBody(body: string, values: Record<string, string>): string {
  let result = body;
  for (const [key, val] of Object.entries(values)) {
    result = result.split(key).join(val || `[${key.replace(/[{}]/g, '')}]`);
  }
  return result;
}

// ─── Variable Fill Form ───────────────────────────────────────────────────────

interface VarFillFormProps {
  template: DocumentTemplate;
  selectedCase: CaseOption | null;
  onGenerate: (doc: PopulatedDoc) => void;
  onCancel: () => void;
}

function VarFillForm({ template, selectedCase, onGenerate, onCancel }: VarFillFormProps) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const v of template.variables) {
      if (v === '{{clientName}}') init[v] = selectedCase?.name ?? '';
      else if (v === '{{clientEmail}}') init[v] = selectedCase?.email ?? '';
      else if (v === '{{firmName}}') init[v] = selectedCase?.firm ?? '';
      else if (v === '{{caseName}}') init[v] = selectedCase ? `${selectedCase.service} — ${selectedCase.name}` : '';
      else if (v === '{{serviceType}}') init[v] = selectedCase?.service ?? '';
      else if (v === '{{agreementDate}}') init[v] = todayStr();
      else init[v] = '';
    }
    return init;
  });

  const preview = populateBody(template.body, values);

  const handleGenerate = () => {
    onGenerate({
      templateId: template.id,
      templateName: template.name,
      body: preview,
      caseId: selectedCase?.id ?? '',
      clientName: values['{{clientName}}'] || selectedCase?.name || 'Client',
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
        <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-secondary/50 text-muted-foreground transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
        </button>
        <div>
          <h3 className="font-semibold text-foreground text-sm">{template.name}</h3>
          <p className="text-xs text-muted-foreground">Fill in variables to generate document</p>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: variable inputs */}
        <div className="w-72 shrink-0 border-r border-border overflow-y-auto p-5 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Variables</p>
          {template.variables.map((v) => (
            <div key={v}>
              <label className="block text-xs font-medium text-foreground mb-1">
                {v.replace(/[{}]/g, '')}
              </label>
              {VARIABLE_HINTS[v] && (
                <p className="text-[11px] text-muted-foreground mb-1">{VARIABLE_HINTS[v]}</p>
              )}
              <input
                type="text"
                value={values[v] ?? ''}
                onChange={(e) => setValues((prev) => ({ ...prev, [v]: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-colors"
                placeholder={`Enter ${v.replace(/[{}]/g, '')}`}
              />
            </div>
          ))}
        </div>

        {/* Right: live preview */}
        <div className="flex-1 overflow-y-auto p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Live Preview</p>
          <pre className="whitespace-pre-wrap font-mono text-xs text-foreground bg-secondary/20 rounded-xl p-5 border border-border leading-relaxed">
            {preview}
          </pre>
        </div>
      </div>

      <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3">
        <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:bg-secondary/40 transition-colors">
          Cancel
        </button>
        <button
          onClick={handleGenerate}
          className="px-5 py-2 text-sm rounded-lg text-white font-semibold transition-colors"
          style={{ background: ACCENT }}
        >
          Generate Document
        </button>
      </div>
    </div>
  );
}

// ─── Generated Document View ──────────────────────────────────────────────────

interface GeneratedDocViewProps {
  doc: PopulatedDoc;
  onBack: () => void;
  onInsertToPortal: (doc: PopulatedDoc) => Promise<void>;
  inserting: boolean;
  inserted: boolean;
}

function GeneratedDocView({ doc, onBack, onInsertToPortal, inserting, inserted }: GeneratedDocViewProps) {
  const handleCopy = () => {
    navigator.clipboard.writeText(doc.body).catch(() => {});
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-secondary/50 text-muted-foreground transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
          </button>
          <div>
            <h3 className="font-semibold text-foreground text-sm">{doc.templateName}</h3>
            <p className="text-xs text-muted-foreground">Generated for {doc.clientName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border text-muted-foreground hover:bg-secondary/40 transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            Copy
          </button>
          <button
            onClick={() => onInsertToPortal(doc)}
            disabled={inserting || inserted}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs rounded-lg text-white font-semibold transition-all disabled:opacity-60"
            style={{ background: inserted ? '#16a34a' : ACCENT }}
          >
            {inserted ? (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Inserted to Portal
              </>
            ) : inserting ? (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                  <line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/>
                  <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
                  <line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>
                  <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
                </svg>
                Inserting…
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                Insert to Client Portal
              </>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <pre className="whitespace-pre-wrap font-mono text-xs text-foreground bg-secondary/20 rounded-xl p-6 border border-border leading-relaxed">
          {doc.body}
        </pre>
      </div>
    </div>
  );
}

// ─── Template Editor ──────────────────────────────────────────────────────────

interface TemplateEditorProps {
  template: DocumentTemplate | null;
  onSave: (data: Partial<DocumentTemplate>) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

function TemplateEditor({ template, onSave, onCancel, saving }: TemplateEditorProps) {
  const [name, setName] = useState(template?.name ?? '');
  const [description, setDescription] = useState(template?.description ?? '');
  const [templateType, setTemplateType] = useState<TemplateType>(template?.template_type ?? 'contract');
  const [body, setBody] = useState(template?.body ?? '');

  const detectedVars = Array.from(new Set((body.match(/\{\{[^}]+\}\}/g) ?? [])));

  const handleSave = () => {
    onSave({ name, description, template_type: templateType, body, variables: detectedVars });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
        <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-secondary/50 text-muted-foreground transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
        </button>
        <h3 className="font-semibold text-foreground text-sm">{template ? 'Edit Template' : 'New Template'}</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Template Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-colors"
              placeholder="e.g. Standard Contract"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Type</label>
            <select
              value={templateType}
              onChange={(e) => setTemplateType(e.target.value as TemplateType)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
            >
              <option value="contract">Contract</option>
              <option value="retainer">Retainer</option>
              <option value="discovery">Discovery</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-colors"
            placeholder="Brief description of this template"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-foreground">Template Body</label>
            <span className="text-[11px] text-muted-foreground">Use {'{{variableName}}'} for auto-fill placeholders</span>
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={20}
            className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-colors resize-none leading-relaxed"
            placeholder="Enter template body. Use {{clientName}}, {{caseName}}, {{agreementDate}}, etc."
          />
        </div>

        {detectedVars.length > 0 && (
          <div>
            <p className="text-xs font-medium text-foreground mb-2">Detected Variables</p>
            <div className="flex flex-wrap gap-1.5">
              {detectedVars.map((v) => (
                <span key={v} className="inline-flex items-center px-2 py-0.5 rounded-md bg-secondary/60 text-xs font-mono text-muted-foreground border border-border">
                  {v}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3">
        <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:bg-secondary/40 transition-colors">
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !name.trim() || !body.trim()}
          className="px-5 py-2 text-sm rounded-lg text-white font-semibold transition-colors disabled:opacity-50"
          style={{ background: ACCENT }}
        >
          {saving ? 'Saving…' : 'Save Template'}
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ContractTemplatesDashboard() {
  const supabase = createClient();

  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [cases, setCases] = useState<CaseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter
  const [filterType, setFilterType] = useState<TemplateType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Panel state
  type PanelMode = 'list' | 'fill' | 'generated' | 'edit';
  const [panelMode, setPanelMode] = useState<PanelMode>('list');
  const [activeTemplate, setActiveTemplate] = useState<DocumentTemplate | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');
  const [generatedDoc, setGeneratedDoc] = useState<PopulatedDoc | null>(null);
  const [saving, setSaving] = useState(false);
  const [inserting, setInserting] = useState(false);
  const [inserted, setInserted] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // ── Load data ──────────────────────────────────────────────────────────────

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('document_templates')
        .select('*')
        .order('template_type')
        .order('created_at');
      if (err) throw err;
      setTemplates(data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const loadCases = useCallback(async () => {
    const { data } = await supabase
      .from('contact_inquiries')
      .select('id, name, email, firm, service')
      .order('name');
    setCases(data ?? []);
  }, [supabase]);

  useEffect(() => {
    loadTemplates();
    loadCases();
  }, [loadTemplates, loadCases]);

  // ── Filtered templates ─────────────────────────────────────────────────────

  const filtered = templates.filter((t) => {
    if (filterType !== 'all' && t.template_type !== filterType) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return t.name.toLowerCase().includes(q) || (t.description ?? '').toLowerCase().includes(q);
    }
    return true;
  });

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleUseTemplate = (template: DocumentTemplate) => {
    setActiveTemplate(template);
    setInserted(false);
    setGeneratedDoc(null);
    setPanelMode('fill');
  };

  const handleGenerate = (doc: PopulatedDoc) => {
    setGeneratedDoc(doc);
    setPanelMode('generated');
  };

  const handleInsertToPortal = async (doc: PopulatedDoc) => {
    if (!doc.caseId) return;
    setInserting(true);
    try {
      const { error: err } = await supabase.from('case_documents').insert({
        inquiry_id: doc.caseId,
        file_name: `${doc.templateName} — ${doc.clientName}.txt`,
        file_url: '',
        file_type: 'text/plain',
        uploaded_by: 'admin',
        category: 'contract',
        description: doc.body,
      });
      if (err) throw err;

      // Also update booking stage to active_client if it's not already
      await supabase
        .from('contact_inquiries')
        .update({ booking_stage: 'active_client' })
        .eq('id', doc.caseId)
        .in('booking_stage', ['inquiry', 'consultation_booked', 'proposal_sent']);

      setInserted(true);
      setSuccessMsg(`"${doc.templateName}" inserted into portal for ${doc.clientName}. Case moved to Active stage.`);
      setTimeout(() => setSuccessMsg(null), 6000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to insert document');
    } finally {
      setInserting(false);
    }
  };

  const handleSaveTemplate = async (data: Partial<DocumentTemplate>) => {
    setSaving(true);
    try {
      if (activeTemplate) {
        const { error: err } = await supabase
          .from('document_templates')
          .update(data)
          .eq('id', activeTemplate.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase
          .from('document_templates')
          .insert({ ...data, is_default: false });
        if (err) throw err;
      }
      await loadTemplates();
      setPanelMode('list');
      setActiveTemplate(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Delete this template? This cannot be undone.')) return;
    const { error: err } = await supabase.from('document_templates').delete().eq('id', id);
    if (err) { setError(err.message); return; }
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  const selectedCase = cases.find((c) => c.id === selectedCaseId) ?? null;

  // ── Render ─────────────────────────────────────────────────────────────────

  if (panelMode === 'fill' && activeTemplate) {
    return (
      <div className="bg-card border border-border rounded-2xl overflow-hidden" style={{ height: '75vh' }}>
        <VarFillForm
          template={activeTemplate}
          selectedCase={selectedCase}
          onGenerate={handleGenerate}
          onCancel={() => { setPanelMode('list'); setActiveTemplate(null); }}
        />
      </div>
    );
  }

  if (panelMode === 'generated' && generatedDoc) {
    return (
      <div className="bg-card border border-border rounded-2xl overflow-hidden" style={{ height: '75vh' }}>
        <GeneratedDocView
          doc={generatedDoc}
          onBack={() => setPanelMode('fill')}
          onInsertToPortal={handleInsertToPortal}
          inserting={inserting}
          inserted={inserted}
        />
      </div>
    );
  }

  if (panelMode === 'edit') {
    return (
      <div className="bg-card border border-border rounded-2xl overflow-hidden" style={{ height: '75vh' }}>
        <TemplateEditor
          template={activeTemplate}
          onSave={handleSaveTemplate}
          onCancel={() => { setPanelMode('list'); setActiveTemplate(null); }}
          saving={saving}
        />
      </div>
    );
  }

  // ── List view ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Success banner */}
      {successMsg && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          {successMsg}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Case selector */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Auto-fill for:</label>
          <select
            value={selectedCaseId}
            onChange={(e) => setSelectedCaseId(e.target.value)}
            className="flex-1 min-w-0 px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
          >
            <option value="">— Select a client / case —</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>{c.name} · {c.service}</option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="relative">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates…"
            className="pl-8 pr-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors w-48"
          />
        </div>

        {/* New template button */}
        <button
          onClick={() => { setActiveTemplate(null); setPanelMode('edit'); }}
          className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg text-white font-semibold transition-colors shrink-0"
          style={{ background: ACCENT }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New Template
        </button>
      </div>

      {/* Type filter tabs */}
      <div className="flex items-center gap-1">
        {(['all', 'contract', 'retainer', 'discovery'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors capitalize ${
              filterType === t
                ? 'bg-secondary/70 text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/30'
            }`}
          >
            {t === 'all' ? 'All Types' : TYPE_META[t].label}
            <span className="ml-1.5 text-[10px] opacity-60">
              {t === 'all' ? templates.length : templates.filter((x) => x.template_type === t).length}
            </span>
          </button>
        ))}
      </div>

      {/* Template grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin mr-2">
            <line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/>
            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
            <line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>
            <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
          </svg>
          Loading templates…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 rounded-2xl bg-secondary/50 flex items-center justify-center mb-3 text-muted-foreground">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <p className="text-sm font-medium text-foreground mb-1">No templates found</p>
          <p className="text-xs text-muted-foreground">Create your first template to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((template) => {
            const meta = TYPE_META[template.template_type];
            return (
              <div
                key={template.id}
                className={`bg-card border rounded-2xl p-5 flex flex-col gap-4 hover:shadow-sm transition-all duration-200 ${meta.border}`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${meta.bg}`} style={{ color: meta.color }}>
                      {meta.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ${meta.badge}`}>
                          {meta.label}
                        </span>
                        {template.is_default && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-secondary/60 text-muted-foreground border border-border">
                            Default
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-foreground text-sm mt-1 leading-snug">{template.name}</h3>
                    </div>
                  </div>
                </div>

                {/* Description */}
                {template.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{template.description}</p>
                )}

                {/* Variables */}
                {template.variables.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {template.variables.slice(0, 4).map((v) => (
                      <span key={v} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-secondary/50 text-muted-foreground border border-border">
                        {v}
                      </span>
                    ))}
                    {template.variables.length > 4 && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-secondary/50 text-muted-foreground border border-border">
                        +{template.variables.length - 4} more
                      </span>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-1 border-t border-border/60 mt-auto">
                  <span className="text-[11px] text-muted-foreground">Updated {formatDate(template.updated_at)}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setActiveTemplate(template); setPanelMode('edit'); }}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                      title="Edit template"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    {!template.is_default && (
                      <button
                        onClick={() => handleDeleteTemplate(template.id)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Delete template"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                          <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={() => handleUseTemplate(template)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg text-white font-semibold transition-colors ml-1"
                      style={{ background: ACCENT }}
                    >
                      Use
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
