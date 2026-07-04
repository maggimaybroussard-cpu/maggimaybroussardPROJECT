'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface CaseStudy {
  id: string;
  title: string;
  client: string;
  service_tag: string;
  complexity: 'Standard' | 'Complex' | 'High-Stakes';
  duration: string;
  outcome: string;
  summary: string;
  published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface CaseStudyForm {
  title: string;
  client: string;
  service_tag: string;
  complexity: 'Standard' | 'Complex' | 'High-Stakes';
  duration: string;
  outcome: string;
  summary: string;
  published: boolean;
  sort_order: number;
}

const COMPLEXITY_OPTIONS = ['Standard', 'Complex', 'High-Stakes'] as const;

const COMPLEXITY_COLORS: Record<string, string> = {
  Standard: 'bg-emerald-100 text-emerald-700',
  Complex: 'bg-amber-100 text-amber-700',
  'High-Stakes': 'bg-red-100 text-red-700',
};

const SERVICE_TAGS = [
  'Litigation Support',
  'Contract Review',
  'Legal Research',
  'Estate Administration',
  'Family Law',
  'Business Law',
  'Real Estate',
  'Immigration',
  'Criminal Defense',
  'Other',
];

const EMPTY_FORM: CaseStudyForm = {
  title: '',
  client: '',
  service_tag: 'Litigation Support',
  complexity: 'Standard',
  duration: '',
  outcome: '',
  summary: '',
  published: false,
  sort_order: 0,
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function CaseStudiesManager() {
  const supabase = createClient();
  const [studies, setStudies] = useState<CaseStudy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editTarget, setEditTarget] = useState<CaseStudy | null>(null);
  const [form, setForm] = useState<CaseStudyForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [tableExists, setTableExists] = useState<boolean | null>(null);

  const fetchStudies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('case_studies')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (err) {
        if (err.code === '42P01') {
          setTableExists(false);
          setStudies([]);
        } else {
          throw err;
        }
      } else {
        setTableExists(true);
        setStudies((data as CaseStudy[]) ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load case studies');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchStudies();
  }, [fetchStudies]);

  useEffect(() => {
    if (saveMsg) {
      const t = setTimeout(() => setSaveMsg(null), 3500);
      return () => clearTimeout(t);
    }
  }, [saveMsg]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditTarget(null);
    setMode('create');
  };

  const openEdit = (study: CaseStudy) => {
    setForm({
      title: study.title,
      client: study.client,
      service_tag: study.service_tag,
      complexity: study.complexity,
      duration: study.duration,
      outcome: study.outcome,
      summary: study.summary,
      published: study.published,
      sort_order: study.sort_order,
    });
    setEditTarget(study);
    setMode('edit');
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.summary.trim()) {
      setSaveMsg({ type: 'error', text: 'Title and summary are required.' });
      return;
    }
    setSaving(true);
    setSaveMsg(null);
    try {
      if (mode === 'create') {
        const { error: err } = await supabase.from('case_studies').insert({
          ...form,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        if (err) throw err;
        setSaveMsg({ type: 'success', text: 'Case study created.' });
      } else if (mode === 'edit' && editTarget) {
        const { error: err } = await supabase
          .from('case_studies')
          .update({ ...form, updated_at: new Date().toISOString() })
          .eq('id', editTarget.id);
        if (err) throw err;
        setSaveMsg({ type: 'success', text: 'Case study updated.' });
      }
      await fetchStudies();
      setMode('list');
    } catch (err) {
      setSaveMsg({ type: 'error', text: err instanceof Error ? err.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this case study? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      const { error: err } = await supabase.from('case_studies').delete().eq('id', id);
      if (err) throw err;
      setStudies((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  const handleTogglePublished = async (study: CaseStudy) => {
    try {
      const { error: err } = await supabase
        .from('case_studies')
        .update({ published: !study.published, updated_at: new Date().toISOString() })
        .eq('id', study.id);
      if (err) throw err;
      setStudies((prev) => prev.map((s) => s.id === study.id ? { ...s, published: !s.published } : s));
    } catch {
      // silently fail
    }
  };

  const filtered = studies.filter(
    (s) =>
      !search ||
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.client.toLowerCase().includes(search.toLowerCase()) ||
      s.service_tag.toLowerCase().includes(search.toLowerCase())
  );

  // ── No Table State ──────────────────────────────────────────────────────────
  if (tableExists === false) {
    return (
      <div className="space-y-6">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
          <div className="flex items-start gap-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600 flex-shrink-0 mt-0.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <div>
              <p className="text-sm font-semibold text-amber-900">Database Table Required</p>
              <p className="text-sm text-amber-800 mt-1">
                The <code className="bg-amber-100 px-1 rounded font-mono text-xs">case_studies</code> table doesn&apos;t exist yet. Run the migration below to enable dynamic case study management.
              </p>
            </div>
          </div>
          <div className="mt-4 bg-amber-100/60 rounded-xl p-4 font-mono text-xs text-amber-900 overflow-x-auto">
            <pre>{`CREATE TABLE IF NOT EXISTS public.case_studies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  client TEXT NOT NULL DEFAULT '',
  service_tag TEXT NOT NULL DEFAULT 'Other',
  complexity TEXT NOT NULL DEFAULT 'Standard',
  duration TEXT NOT NULL DEFAULT '',
  outcome TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  published BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.case_studies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access" ON public.case_studies
  USING (auth.role() = 'authenticated');`}</pre>
          </div>
          <p className="text-xs text-amber-700 mt-3">
            Until the table is created, the existing static case studies on the public <strong>/case-studies</strong> page will continue to display normally.
          </p>
        </div>
      </div>
    );
  }

  // ── Form (Create / Edit) ────────────────────────────────────────────────────
  if (mode === 'create' || mode === 'edit') {
    return (
      <div className="max-w-2xl space-y-6">
        {/* Back */}
        <button
          onClick={() => setMode('list')}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Back to Case Studies
        </button>

        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <h2 className="font-serif text-xl text-foreground">
            {mode === 'create' ? 'New Case Study' : 'Edit Case Study'}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">Title *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Multi-Party Commercial Litigation Trial Prep"
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">Client / Firm</label>
              <input
                type="text"
                value={form.client}
                onChange={(e) => setForm((f) => ({ ...f, client: e.target.value }))}
                placeholder="e.g. Regional Law Firm — 12 Attorneys"
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">Service Tag</label>
              <select
                value={form.service_tag}
                onChange={(e) => setForm((f) => ({ ...f, service_tag: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all appearance-none"
              >
                {SERVICE_TAGS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">Complexity</label>
              <div className="flex gap-2">
                {COMPLEXITY_OPTIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, complexity: c }))}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${
                      form.complexity === c ? COMPLEXITY_COLORS[c] + ' border-transparent' : 'bg-card border-border text-muted-foreground hover:border-accent/40'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">Duration</label>
              <input
                type="text"
                value={form.duration}
                onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
                placeholder="e.g. 6 weeks"
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">Outcome</label>
              <input
                type="text"
                value={form.outcome}
                onChange={(e) => setForm((f) => ({ ...f, outcome: e.target.value }))}
                placeholder="e.g. Favorable Settlement"
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">Summary *</label>
              <textarea
                rows={5}
                value={form.summary}
                onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
                placeholder="Describe the client situation, challenge, and what was accomplished…"
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all resize-none"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">Sort Order</label>
              <input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm((f) => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all"
              />
            </div>

            <div className="flex items-center gap-3 pt-6">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, published: !f.published }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.published ? 'bg-primary' : 'bg-secondary'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.published ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
              <span className="text-sm text-foreground font-medium">{form.published ? 'Published' : 'Draft'}</span>
            </div>
          </div>

          {saveMsg && (
            <div className={`p-3 rounded-xl text-xs font-medium ${saveMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {saveMsg.text}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-semibold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {saving && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
              )}
              {saving ? 'Saving…' : mode === 'create' ? 'Create Case Study' : 'Save Changes'}
            </button>
            <button
              onClick={() => setMode('list')}
              className="px-6 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── List View ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search case studies…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all"
          />
        </div>
        <button
          onClick={fetchStudies}
          className="px-4 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm font-medium hover:border-accent/50 transition-all flex items-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
          </svg>
          Refresh
        </button>
        <button
          onClick={openCreate}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all hover:opacity-90 flex items-center gap-2"
          style={{ background: '#355E3B', color: '#fff' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New Case Study
        </button>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary flex-shrink-0 mt-0.5">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p className="text-xs text-muted-foreground">
          Case studies created here are stored in the database. The public <strong>/case-studies</strong> page currently uses static data — connect it to this table to display dynamic content.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total', value: studies.length },
          { label: 'Published', value: studies.filter((s) => s.published).length },
          { label: 'Drafts', value: studies.filter((s) => !s.published).length },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{loading ? '—' : s.value}</p>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border-b border-border last:border-0 px-5 py-4 flex items-center gap-4">
              <div className="flex-1">
                <div className="w-48 h-4 bg-secondary animate-pulse rounded mb-1.5" />
                <div className="w-32 h-3 bg-secondary/70 animate-pulse rounded" />
              </div>
              <div className="w-20 h-5 bg-secondary animate-pulse rounded-full hidden sm:block" />
              <div className="w-16 h-5 bg-secondary animate-pulse rounded-full" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <div className="w-14 h-14 rounded-full bg-muted/40 flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
            </svg>
          </div>
          <p className="text-sm font-medium text-foreground mb-1">No case studies yet</p>
          <p className="text-xs text-muted-foreground mb-4">Create your first case study to showcase your work.</p>
          <button
            onClick={openCreate}
            className="px-5 py-2 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all hover:opacity-90"
            style={{ background: '#355E3B', color: '#fff' }}
          >
            Create First Case Study
          </button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/40">
                  <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Title</th>
                  <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden sm:table-cell">Service</th>
                  <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden md:table-cell">Complexity</th>
                  <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Status</th>
                  <th className="text-right px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((study, i) => (
                  <tr key={study.id} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-foreground">{study.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{study.client}</p>
                    </td>
                    <td className="px-5 py-3.5 hidden sm:table-cell">
                      <span className="text-xs text-muted-foreground">{study.service_tag}</span>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${COMPLEXITY_COLORS[study.complexity] ?? 'bg-gray-100 text-gray-500'}`}>
                        {study.complexity}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => handleTogglePublished(study)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                          study.published
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200' :'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${study.published ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                        {study.published ? 'Published' : 'Draft'}
                      </button>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(study)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                          title="Edit"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(study.id)}
                          disabled={deletingId === study.id}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-50"
                          title="Delete"
                        >
                          {deletingId === study.id ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                            </svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
                            </svg>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-border bg-secondary/20 text-xs text-muted-foreground">
            {filtered.length} of {studies.length} case {studies.length === 1 ? 'study' : 'studies'}
          </div>
        </div>
      )}
    </div>
  );
}
