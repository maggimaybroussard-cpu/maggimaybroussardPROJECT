'use client';

import React, { useState, useEffect, useRef } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CaseSearchFilters {
  name: string;
  email: string;
  firm: string;
  service: string;
  status: string;
  stage: string;
  dateFrom: string;
  dateTo: string;
}

export interface SavedSearchTemplate {
  id: string;
  label: string;
  filters: CaseSearchFilters;
  createdAt: string;
}

interface CaseSearchPanelProps {
  filters: CaseSearchFilters;
  onChange: (filters: CaseSearchFilters) => void;
  resultCount: number;
  totalCount: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EMPTY_FILTERS: CaseSearchFilters = {
  name: '',
  email: '',
  firm: '',
  service: '',
  status: '',
  stage: '',
  dateFrom: '',
  dateTo: '',
};

const SERVICE_OPTIONS = [
  'Business Formation',
  'Contract Drafting',
  'Contract Review',
  'Legal Consultation',
  'Compliance Review',
  'Trademark Registration',
  'Employment Law',
  'Real Estate',
  'Litigation Support',
  'Other',
];

const STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'in_review', label: 'In Review' },
  { value: 'contacted', label: 'In Progress' },
  { value: 'closed', label: 'Closed' },
];

const STAGE_OPTIONS = [
  { value: 'inquiry', label: 'Intake' },
  { value: 'consultation_booked', label: 'Consultation Booked' },
  { value: 'proposal_sent', label: 'Proposal Sent' },
  { value: 'active_client', label: 'Active' },
  { value: 'completed', label: 'Billed' },
  { value: 'closed', label: 'Closed' },
];

const QUICK_DATE_RANGES = [
  { label: 'Today', days: 0 },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'This year', days: 365 },
];

const STORAGE_KEY = 'case_search_templates';
const ACCENT = '#355E3B';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadTemplates(): SavedSearchTemplate[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveTemplates(templates: SavedSearchTemplate[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  } catch {
    // ignore
  }
}

function hasActiveFilters(f: CaseSearchFilters): boolean {
  return Object.values(f).some((v) => v !== '');
}

function countActiveFilters(f: CaseSearchFilters): number {
  return Object.values(f).filter((v) => v !== '').length;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CaseSearchPanel({
  filters,
  onChange,
  resultCount,
  totalCount,
}: CaseSearchPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [templates, setTemplates] = useState<SavedSearchTemplate[]>([]);
  const [saveLabel, setSaveLabel] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [mounted, setMounted] = useState(false);
  const saveInputRef = useRef<HTMLInputElement>(null);
  const templatesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    setTemplates(loadTemplates());
  }, []);

  // Close templates dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (templatesRef.current && !templatesRef.current.contains(e.target as Node)) {
        setShowTemplates(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (showSaveInput && saveInputRef.current) {
      saveInputRef.current.focus();
    }
  }, [showSaveInput]);

  const update = (field: keyof CaseSearchFilters, value: string) => {
    onChange({ ...filters, [field]: value });
  };

  const clearAll = () => {
    onChange({ ...EMPTY_FILTERS });
  };

  const applyQuickDate = (days: number) => {
    const now = new Date();
    const to = now.toISOString().split('T')[0];
    if (days === 0) {
      onChange({ ...filters, dateFrom: to, dateTo: to });
    } else {
      const from = new Date(now);
      from.setDate(from.getDate() - days);
      onChange({ ...filters, dateFrom: from.toISOString().split('T')[0], dateTo: to });
    }
  };

  const saveTemplate = () => {
    if (!saveLabel.trim()) return;
    const newTemplate: SavedSearchTemplate = {
      id: `tpl-${Date.now()}`,
      label: saveLabel.trim(),
      filters: { ...filters },
      createdAt: new Date().toISOString(),
    };
    const updated = [newTemplate, ...templates].slice(0, 10);
    setTemplates(updated);
    saveTemplates(updated);
    setSaveLabel('');
    setShowSaveInput(false);
  };

  const applyTemplate = (tpl: SavedSearchTemplate) => {
    onChange({ ...tpl.filters });
    setShowTemplates(false);
  };

  const deleteTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = templates.filter((t) => t.id !== id);
    setTemplates(updated);
    saveTemplates(updated);
  };

  const activeCount = countActiveFilters(filters);
  const isFiltered = hasActiveFilters(filters);

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* ── Top bar ── */}
      <div className="px-4 py-3 flex flex-col sm:flex-row gap-3 items-start sm:items-center border-b border-border/60">
        {/* Quick search */}
        <div className="relative flex-1 min-w-0">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 pointer-events-none"
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search by name, email, firm, or service…"
            value={filters.name || filters.email || filters.firm || filters.service
              ? [filters.name, filters.email, filters.firm, filters.service].filter(Boolean).join(' · ')
              : ''}
            readOnly
            onClick={() => setExpanded(true)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all cursor-pointer"
          />
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Result count */}
          {isFiltered && (
            <span className="text-xs text-muted-foreground bg-secondary/60 px-2.5 py-1 rounded-lg border border-border">
              {resultCount} / {totalCount}
            </span>
          )}

          {/* Active filter badge */}
          {activeCount > 0 && (
            <span
              className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg text-white"
              style={{ background: ACCENT }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              {activeCount} filter{activeCount !== 1 ? 's' : ''}
            </span>
          )}

          {/* Saved templates dropdown */}
          {mounted && (
            <div className="relative" ref={templatesRef}>
              <button
                onClick={() => setShowTemplates(!showTemplates)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card text-xs font-medium text-muted-foreground hover:text-foreground hover:border-accent/40 transition-all"
                title="Saved search templates"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
                </svg>
                Templates
                {templates.length > 0 && (
                  <span className="w-4 h-4 rounded-full bg-accent/20 text-accent text-[9px] font-bold flex items-center justify-center" style={{ color: ACCENT }}>
                    {templates.length}
                  </span>
                )}
              </button>

              {showTemplates && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden">
                  <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
                    <p className="text-xs font-semibold text-foreground uppercase tracking-widest">Saved Templates</p>
                    <span className="text-[10px] text-muted-foreground">{templates.length}/10</span>
                  </div>
                  {templates.length === 0 ? (
                    <div className="px-4 py-6 text-center">
                      <p className="text-xs text-muted-foreground">No saved templates yet.</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">Apply filters and click "Save Search".</p>
                    </div>
                  ) : (
                    <div className="max-h-64 overflow-y-auto">
                      {templates.map((tpl) => (
                        <button
                          key={tpl.id}
                          onClick={() => applyTemplate(tpl)}
                          className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-secondary/40 transition-colors group text-left"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{tpl.label}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {countActiveFilters(tpl.filters)} filter{countActiveFilters(tpl.filters) !== 1 ? 's' : ''}
                            </p>
                          </div>
                          <button
                            onClick={(e) => deleteTemplate(tpl.id, e)}
                            className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center text-muted-foreground/40 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                            title="Delete template"
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Expand/collapse */}
          <button
            onClick={() => setExpanded(!expanded)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
              expanded
                ? 'border-accent/50 bg-accent/5 text-foreground'
                : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-accent/40'
            }`}
            style={expanded ? { borderColor: `${ACCENT}50`, color: ACCENT } : {}}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            Filters
            <svg
              width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {/* Clear all */}
          {isFiltered && (
            <button
              onClick={clearAll}
              className="flex items-center gap-1 px-3 py-2 rounded-xl border border-red-200 bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 transition-all"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Expanded filter panel ── */}
      {expanded && (
        <div className="px-4 py-4 space-y-4 border-b border-border/60 bg-secondary/10">
          {/* Multi-field text search row */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2.5">Search Fields</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { field: 'name' as const, label: 'Client Name', placeholder: 'e.g. Jane Smith' },
                { field: 'email' as const, label: 'Email', placeholder: 'e.g. jane@firm.com' },
                { field: 'firm' as const, label: 'Firm / Company', placeholder: 'e.g. Acme Corp' },
              ].map(({ field, label, placeholder }) => (
                <div key={field}>
                  <label className="block text-[10px] text-muted-foreground font-medium mb-1">{label}</label>
                  <input
                    type="text"
                    placeholder={placeholder}
                    value={filters[field]}
                    onChange={(e) => update(field, e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
                  />
                </div>
              ))}
              <div>
                <label className="block text-[10px] text-muted-foreground font-medium mb-1">Service Type</label>
                <select
                  value={filters.service}
                  onChange={(e) => update('service', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
                >
                  <option value="">All Services</option>
                  {SERVICE_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Status + Stage row */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2.5">Status & Stage</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-muted-foreground font-medium mb-1">Case Status</label>
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => update('status', filters.status === opt.value ? '' : opt.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        filters.status === opt.value
                          ? 'text-white border-transparent' :'border-border bg-card text-muted-foreground hover:border-accent/40 hover:text-foreground'
                      }`}
                      style={filters.status === opt.value ? { background: ACCENT, borderColor: ACCENT } : {}}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-muted-foreground font-medium mb-1">Kanban Stage</label>
                <div className="flex flex-wrap gap-2">
                  {STAGE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => update('stage', filters.stage === opt.value ? '' : opt.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        filters.stage === opt.value
                          ? 'text-white border-transparent' :'border-border bg-card text-muted-foreground hover:border-accent/40 hover:text-foreground'
                      }`}
                      style={filters.stage === opt.value ? { background: ACCENT, borderColor: ACCENT } : {}}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Date range row */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2.5">Date Range (Created)</p>
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
              <div className="flex items-end gap-2">
                <div>
                  <label className="block text-[10px] text-muted-foreground font-medium mb-1">From</label>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => update('dateFrom', e.target.value)}
                    className="px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
                  />
                </div>
                <span className="text-muted-foreground text-sm pb-2">–</span>
                <div>
                  <label className="block text-[10px] text-muted-foreground font-medium mb-1">To</label>
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => update('dateTo', e.target.value)}
                    className="px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
                  />
                </div>
              </div>
              {/* Quick date presets */}
              <div className="flex flex-wrap gap-1.5">
                {QUICK_DATE_RANGES.map((qd) => (
                  <button
                    key={qd.label}
                    onClick={() => applyQuickDate(qd.days)}
                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium border border-border bg-card text-muted-foreground hover:border-accent/40 hover:text-foreground transition-all"
                  >
                    {qd.label}
                  </button>
                ))}
                {(filters.dateFrom || filters.dateTo) && (
                  <button
                    onClick={() => onChange({ ...filters, dateFrom: '', dateTo: '' })}
                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 transition-all"
                  >
                    Clear dates
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Save search template */}
          <div className="pt-2 border-t border-border/60 flex items-center gap-3">
            {!showSaveInput ? (
              <button
                onClick={() => setShowSaveInput(true)}
                disabled={!isFiltered}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card text-xs font-medium text-muted-foreground hover:text-foreground hover:border-accent/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
                </svg>
                Save Search as Template
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  ref={saveInputRef}
                  type="text"
                  placeholder="Template name…"
                  value={saveLabel}
                  onChange={(e) => setSaveLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveTemplate();
                    if (e.key === 'Escape') { setShowSaveInput(false); setSaveLabel(''); }
                  }}
                  className="px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all w-48"
                />
                <button
                  onClick={saveTemplate}
                  disabled={!saveLabel.trim()}
                  className="px-3 py-2 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: ACCENT }}
                >
                  Save
                </button>
                <button
                  onClick={() => { setShowSaveInput(false); setSaveLabel(''); }}
                  className="px-3 py-2 rounded-lg text-xs font-medium border border-border bg-card text-muted-foreground hover:text-foreground transition-all"
                >
                  Cancel
                </button>
              </div>
            )}
            {isFiltered && (
              <span className="text-xs text-muted-foreground">
                Showing <span className="font-semibold text-foreground">{resultCount}</span> of {totalCount} cases
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Active filter chips (when collapsed) ── */}
      {!expanded && isFiltered && (
        <div className="px-4 py-2.5 flex flex-wrap gap-2 bg-secondary/10">
          {Object.entries(filters).map(([key, value]) => {
            if (!value) return null;
            const labels: Record<string, string> = {
              name: 'Name',
              email: 'Email',
              firm: 'Firm',
              service: 'Service',
              status: 'Status',
              stage: 'Stage',
              dateFrom: 'From',
              dateTo: 'To',
            };
            return (
              <span
                key={key}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-card border border-border text-foreground"
              >
                <span className="text-muted-foreground">{labels[key]}:</span>
                <span className="max-w-[120px] truncate">{value}</span>
                <button
                  onClick={() => update(key as keyof CaseSearchFilters, '')}
                  className="text-muted-foreground/50 hover:text-red-500 transition-colors ml-0.5"
                >
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
