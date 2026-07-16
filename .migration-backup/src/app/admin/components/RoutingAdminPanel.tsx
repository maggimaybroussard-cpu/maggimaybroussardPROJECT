'use client';

import React, { useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParalegalProfile {
  id: string;
  name: string;
  initials: string;
  email: string;
  specialties: string[];
  availability: 'available' | 'busy' | 'unavailable';
  currentLoad: number; // active cases
}

interface ServiceMapping {
  service: string;
  primaryParalegal: string;
  backupParalegal: string;
  autoRoute: boolean;
}

interface WorkloadThreshold {
  paralegalId: string;
  warningAt: number;
  criticalAt: number;
  maxCapacity: number;
}

interface SkillPriority {
  service: string;
  skills: string[];
  priorityOrder: string[]; // paralegal ids in priority order
  requiresExpertise: boolean;
}

interface AccuracyMetric {
  service: string;
  totalSuggestions: number;
  accepted: number;
  ignored: number;
  overridden: number;
  accuracyRate: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SERVICES = [
  'Litigation Support',
  'Contract Review',
  'Legal Research',
  'Document Drafting',
  'Case Management',
  'Deposition Prep',
];

const INITIAL_PARALEGALS: ParalegalProfile[] = [
  {
    id: 'p1',
    name: 'Maggi May Broussard',
    initials: 'MB',
    email: 'maggi@broussardlegalservices.com',
    specialties: ['Litigation Support', 'Document Drafting', 'Deposition Prep'],
    availability: 'available',
    currentLoad: 8,
  },
  {
    id: 'p2',
    name: 'Sarah Chen',
    initials: 'SC',
    email: 'sarah@broussardlegalservices.com',
    specialties: ['Contract Review', 'Legal Research'],
    availability: 'busy',
    currentLoad: 14,
  },
  {
    id: 'p3',
    name: 'James Tran',
    initials: 'JT',
    email: 'james@broussardlegalservices.com',
    specialties: ['Case Management', 'Legal Research', 'Document Drafting'],
    availability: 'available',
    currentLoad: 6,
  },
];

const INITIAL_MAPPINGS: ServiceMapping[] = SERVICES.map((service) => ({
  service,
  primaryParalegal: INITIAL_PARALEGALS.find((p) => p.specialties.includes(service))?.id ?? 'p1',
  backupParalegal: 'p3',
  autoRoute: true,
}));

const INITIAL_THRESHOLDS: WorkloadThreshold[] = INITIAL_PARALEGALS.map((p) => ({
  paralegalId: p.id,
  warningAt: 10,
  criticalAt: 15,
  maxCapacity: 20,
}));

const INITIAL_SKILL_PRIORITIES: SkillPriority[] = SERVICES.map((service) => ({
  service,
  skills: [],
  priorityOrder: INITIAL_PARALEGALS.filter((p) => p.specialties.includes(service)).map((p) => p.id),
  requiresExpertise: false,
}));

const MOCK_ACCURACY: AccuracyMetric[] = SERVICES.map((service, i) => {
  const total = 20 + i * 7;
  const accepted = Math.floor(total * (0.6 + i * 0.03));
  const ignored = Math.floor((total - accepted) * 0.4);
  const overridden = total - accepted - ignored;
  return {
    service,
    totalSuggestions: total,
    accepted,
    ignored,
    overridden,
    accuracyRate: Math.round((accepted / total) * 100),
  };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAvailabilityColor(a: ParalegalProfile['availability']) {
  if (a === 'available') return 'bg-emerald-100 text-emerald-700';
  if (a === 'busy') return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
}

function getLoadColor(load: number, thresholds: WorkloadThreshold, paralegalId: string) {
  const t = thresholds;
  if (load >= t.criticalAt) return 'text-red-600';
  if (load >= t.warningAt) return 'text-amber-600';
  return 'text-emerald-600';
}

function getAccuracyColor(rate: number) {
  if (rate >= 75) return 'text-emerald-600';
  if (rate >= 50) return 'text-amber-600';
  return 'text-red-600';
}

function AccuracyBar({ value }: { value: number }) {
  const color = value >= 75 ? 'bg-emerald-500' : value >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${value}%` }} />
    </div>
  );
}

// ─── Section: Service Mappings ────────────────────────────────────────────────

function ServiceMappingsSection({
  mappings,
  paralegals,
  onChange,
}: {
  mappings: ServiceMapping[];
  paralegals: ParalegalProfile[];
  onChange: (updated: ServiceMapping[]) => void;
}) {
  const [saved, setSaved] = useState(false);

  const update = (service: string, field: keyof ServiceMapping, value: string | boolean) => {
    onChange(mappings.map((m) => (m.service === service ? { ...m, [field]: value } : m)));
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Service → Paralegal Mappings</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Assign primary and backup paralegals for each service type</p>
        </div>
        <button
          onClick={handleSave}
          className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold uppercase tracking-widest hover:opacity-90 transition-all flex items-center gap-1.5"
        >
          {saved ? (
            <>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Saved
            </>
          ) : 'Save Mappings'}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Service</th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Primary Paralegal</th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Backup Paralegal</th>
              <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Auto-Route</th>
            </tr>
          </thead>
          <tbody>
            {mappings.map((m, i) => (
              <tr key={m.service} className={`border-b border-border last:border-0 ${i % 2 === 0 ? 'bg-background' : 'bg-secondary/10'}`}>
                <td className="px-4 py-3">
                  <span className="font-medium text-foreground text-sm">{m.service}</span>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={m.primaryParalegal}
                    onChange={(e) => update(m.service, 'primaryParalegal', e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-input text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent/40"
                  >
                    {paralegals.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={m.backupParalegal}
                    onChange={(e) => update(m.service, 'backupParalegal', e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-input text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent/40"
                  >
                    <option value="">— None —</option>
                    {paralegals.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => update(m.service, 'autoRoute', !m.autoRoute)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${m.autoRoute ? 'bg-primary' : 'bg-border'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${m.autoRoute ? 'translate-x-4' : 'translate-x-1'}`} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Section: Workload Thresholds ─────────────────────────────────────────────

function WorkloadThresholdsSection({
  thresholds,
  paralegals,
  onChange,
}: {
  thresholds: WorkloadThreshold[];
  paralegals: ParalegalProfile[];
  onChange: (updated: WorkloadThreshold[]) => void;
}) {
  const [saved, setSaved] = useState(false);

  const update = (paralegalId: string, field: keyof WorkloadThreshold, value: number) => {
    onChange(thresholds.map((t) => (t.paralegalId === paralegalId ? { ...t, [field]: value } : t)));
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Workload Thresholds</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Set warning, critical, and max capacity limits per paralegal</p>
        </div>
        <button
          onClick={handleSave}
          className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold uppercase tracking-widest hover:opacity-90 transition-all flex items-center gap-1.5"
        >
          {saved ? (
            <>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Saved
            </>
          ) : 'Save Thresholds'}
        </button>
      </div>

      <div className="grid gap-4">
        {thresholds.map((t) => {
          const p = paralegals.find((x) => x.id === t.paralegalId);
          if (!p) return null;
          const loadPct = Math.min(100, Math.round((p.currentLoad / t.maxCapacity) * 100));
          const barColor = p.currentLoad >= t.criticalAt ? 'bg-red-500' : p.currentLoad >= t.warningAt ? 'bg-amber-500' : 'bg-emerald-500';

          return (
            <div key={t.paralegalId} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                  {p.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{p.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getAvailabilityColor(p.availability)}`}>
                      {p.availability}
                    </span>
                    <span className={`text-xs font-semibold ${getLoadColor(p.currentLoad, t, p.id)}`}>
                      {p.currentLoad} active cases
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted-foreground">Capacity</p>
                  <p className="text-sm font-bold text-foreground">{loadPct}%</p>
                </div>
              </div>

              {/* Load bar */}
              <div className="relative h-2 bg-secondary rounded-full overflow-hidden mb-4">
                <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${loadPct}%` }} />
                {/* Warning marker */}
                <div className="absolute top-0 h-full w-0.5 bg-amber-400/70" style={{ left: `${Math.min(100, (t.warningAt / t.maxCapacity) * 100)}%` }} />
                {/* Critical marker */}
                <div className="absolute top-0 h-full w-0.5 bg-red-400/70" style={{ left: `${Math.min(100, (t.criticalAt / t.maxCapacity) * 100)}%` }} />
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Warning at', field: 'warningAt' as const, value: t.warningAt, color: 'text-amber-600' },
                  { label: 'Critical at', field: 'criticalAt' as const, value: t.criticalAt, color: 'text-red-600' },
                  { label: 'Max capacity', field: 'maxCapacity' as const, value: t.maxCapacity, color: 'text-foreground' },
                ].map(({ label, field, value, color }) => (
                  <div key={field}>
                    <label className="block text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">{label}</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        max={99}
                        value={value}
                        onChange={(e) => update(t.paralegalId, field, parseInt(e.target.value) || 1)}
                        className={`w-full px-2.5 py-1.5 rounded-lg border border-border bg-input text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-accent/40 ${color}`}
                      />
                      <span className="text-xs text-muted-foreground shrink-0">cases</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Section: Skill-Based Routing Priorities ──────────────────────────────────

function SkillRoutingSection({
  priorities,
  paralegals,
  onChange,
}: {
  priorities: SkillPriority[];
  paralegals: ParalegalProfile[];
  onChange: (updated: SkillPriority[]) => void;
}) {
  const [saved, setSaved] = useState(false);
  const [expandedService, setExpandedService] = useState<string | null>(SERVICES[0]);

  const toggleExpertise = (service: string) => {
    onChange(priorities.map((p) => (p.service === service ? { ...p, requiresExpertise: !p.requiresExpertise } : p)));
  };

  const movePriority = (service: string, paralegalId: string, direction: 'up' | 'down') => {
    onChange(priorities.map((p) => {
      if (p.service !== service) return p;
      const order = [...p.priorityOrder];
      const idx = order.indexOf(paralegalId);
      if (idx === -1) return p;
      const newIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= order.length) return p;
      [order[idx], order[newIdx]] = [order[newIdx], order[idx]];
      return { ...p, priorityOrder: order };
    }));
  };

  const toggleParalegalInPriority = (service: string, paralegalId: string) => {
    onChange(priorities.map((p) => {
      if (p.service !== service) return p;
      const inList = p.priorityOrder.includes(paralegalId);
      return {
        ...p,
        priorityOrder: inList
          ? p.priorityOrder.filter((id) => id !== paralegalId)
          : [...p.priorityOrder, paralegalId],
      };
    }));
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Skill-Based Routing Priorities</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Define which paralegals handle each service and in what order</p>
        </div>
        <button
          onClick={handleSave}
          className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold uppercase tracking-widest hover:opacity-90 transition-all flex items-center gap-1.5"
        >
          {saved ? (
            <>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Saved
            </>
          ) : 'Save Priorities'}
        </button>
      </div>

      <div className="space-y-2">
        {priorities.map((sp) => {
          const isOpen = expandedService === sp.service;
          return (
            <div key={sp.service} className="rounded-xl border border-border bg-card overflow-hidden">
              <button
                onClick={() => setExpandedService(isOpen ? null : sp.service)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/20 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-foreground">{sp.service}</span>
                  <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                    {sp.priorityOrder.length} paralegal{sp.priorityOrder.length !== 1 ? 's' : ''}
                  </span>
                  {sp.requiresExpertise && (
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                      Expertise Required
                    </span>
                  )}
                </div>
                <svg
                  width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className={`text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`}
                >
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>

              {isOpen && (
                <div className="px-4 pb-4 border-t border-border bg-secondary/5">
                  {/* Expertise toggle */}
                  <div className="flex items-center justify-between py-3 border-b border-border mb-3">
                    <div>
                      <p className="text-xs font-semibold text-foreground">Require Expertise</p>
                      <p className="text-[10px] text-muted-foreground">Only route to paralegals with this specialty</p>
                    </div>
                    <button
                      onClick={() => toggleExpertise(sp.service)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${sp.requiresExpertise ? 'bg-primary' : 'bg-border'}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${sp.requiresExpertise ? 'translate-x-4' : 'translate-x-1'}`} />
                    </button>
                  </div>

                  {/* Priority order */}
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Priority Order</p>
                  <div className="space-y-1.5 mb-3">
                    {sp.priorityOrder.map((pid, idx) => {
                      const p = paralegals.find((x) => x.id === pid);
                      if (!p) return null;
                      return (
                        <div key={pid} className="flex items-center gap-2 bg-background rounded-lg px-3 py-2 border border-border">
                          <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-foreground shrink-0">
                            {p.initials}
                          </div>
                          <span className="flex-1 text-xs font-medium text-foreground">{p.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${getAvailabilityColor(p.availability)}`}>
                            {p.availability}
                          </span>
                          <div className="flex gap-0.5">
                            <button
                              onClick={() => movePriority(sp.service, pid, 'up')}
                              disabled={idx === 0}
                              className="p-1 rounded hover:bg-secondary disabled:opacity-30 transition-colors"
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="18 15 12 9 6 15"/>
                              </svg>
                            </button>
                            <button
                              onClick={() => movePriority(sp.service, pid, 'down')}
                              disabled={idx === sp.priorityOrder.length - 1}
                              className="p-1 rounded hover:bg-secondary disabled:opacity-30 transition-colors"
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="6 9 12 15 18 9"/>
                              </svg>
                            </button>
                            <button
                              onClick={() => toggleParalegalInPriority(sp.service, pid)}
                              className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                              </svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {sp.priorityOrder.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-3 bg-secondary/20 rounded-lg">No paralegals assigned — add one below</p>
                    )}
                  </div>

                  {/* Add paralegals not in list */}
                  {paralegals.filter((p) => !sp.priorityOrder.includes(p.id)).length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">Add Paralegal</p>
                      <div className="flex flex-wrap gap-1.5">
                        {paralegals.filter((p) => !sp.priorityOrder.includes(p.id)).map((p) => (
                          <button
                            key={p.id}
                            onClick={() => toggleParalegalInPriority(sp.service, p.id)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                            </svg>
                            {p.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Section: Suggestion Accuracy Metrics ─────────────────────────────────────

function AccuracyMetricsSection({ metrics }: { metrics: AccuracyMetric[] }) {
  const totalSuggestions = metrics.reduce((s, m) => s + m.totalSuggestions, 0);
  const totalAccepted = metrics.reduce((s, m) => s + m.accepted, 0);
  const overallRate = totalSuggestions > 0 ? Math.round((totalAccepted / totalSuggestions) * 100) : 0;

  return (
    <div>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">Suggestion Accuracy Metrics</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Review how often auto-routing suggestions are accepted vs. overridden</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Suggestions', value: totalSuggestions, color: 'text-foreground', bg: 'bg-secondary/30' },
          { label: 'Accepted', value: totalAccepted, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Ignored', value: metrics.reduce((s, m) => s + m.ignored, 0), color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Overridden', value: metrics.reduce((s, m) => s + m.overridden, 0), color: 'text-red-600', bg: 'bg-red-50' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`rounded-xl p-3 ${bg} border border-border`}>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Overall accuracy */}
      <div className="rounded-xl border border-border bg-card p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-foreground">Overall Accuracy Rate</p>
          <span className={`text-lg font-bold ${getAccuracyColor(overallRate)}`}>{overallRate}%</span>
        </div>
        <AccuracyBar value={overallRate} />
        <p className="text-[10px] text-muted-foreground mt-1.5">
          {overallRate >= 75 ? 'Routing suggestions are performing well.' : overallRate >= 50 ? 'Consider reviewing keyword mappings for lower-performing services.' : 'Accuracy is low — review service keyword configurations.'}
        </p>
      </div>

      {/* Per-service breakdown */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Service</th>
              <th className="text-center px-3 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Total</th>
              <th className="text-center px-3 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Accepted</th>
              <th className="text-center px-3 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Ignored</th>
              <th className="text-center px-3 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Overridden</th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Accuracy</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m, i) => (
              <tr key={m.service} className={`border-b border-border last:border-0 ${i % 2 === 0 ? 'bg-background' : 'bg-secondary/10'}`}>
                <td className="px-4 py-3 font-medium text-foreground text-sm">{m.service}</td>
                <td className="px-3 py-3 text-center text-sm text-muted-foreground">{m.totalSuggestions}</td>
                <td className="px-3 py-3 text-center">
                  <span className="text-sm font-semibold text-emerald-600">{m.accepted}</span>
                </td>
                <td className="px-3 py-3 text-center">
                  <span className="text-sm font-semibold text-amber-600">{m.ignored}</span>
                </td>
                <td className="px-3 py-3 text-center">
                  <span className="text-sm font-semibold text-red-600">{m.overridden}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold w-10 shrink-0 ${getAccuracyColor(m.accuracyRate)}`}>{m.accuracyRate}%</span>
                    <div className="flex-1 min-w-[60px]">
                      <AccuracyBar value={m.accuracyRate} />
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type PanelSection = 'mappings' | 'thresholds' | 'skills' | 'accuracy';

const SECTIONS: { id: PanelSection; label: string; icon: React.ReactNode }[] = [
  {
    id: 'mappings',
    label: 'Service Mappings',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
      </svg>
    ),
  },
  {
    id: 'thresholds',
    label: 'Workload Thresholds',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
      </svg>
    ),
  },
  {
    id: 'skills',
    label: 'Routing Priorities',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
      </svg>
    ),
  },
  {
    id: 'accuracy',
    label: 'Accuracy Metrics',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>
      </svg>
    ),
  },
];

export default function RoutingAdminPanel() {
  const [activeSection, setActiveSection] = useState<PanelSection>('mappings');
  const [paralegals] = useState<ParalegalProfile[]>(INITIAL_PARALEGALS);
  const [mappings, setMappings] = useState<ServiceMapping[]>(INITIAL_MAPPINGS);
  const [thresholds, setThresholds] = useState<WorkloadThreshold[]>(INITIAL_THRESHOLDS);
  const [skillPriorities, setSkillPriorities] = useState<SkillPriority[]>(INITIAL_SKILL_PRIORITIES);
  const [accuracyMetrics] = useState<AccuracyMetric[]>(MOCK_ACCURACY);

  return (
    <div className="space-y-6">
      {/* Paralegal status bar */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-3">Paralegal Status</p>
        <div className="flex flex-wrap gap-3">
          {paralegals.map((p) => {
            const t = thresholds.find((x) => x.paralegalId === p.id);
            const loadPct = t ? Math.min(100, Math.round((p.currentLoad / t.maxCapacity) * 100)) : 0;
            const barColor = t && p.currentLoad >= t.criticalAt ? 'bg-red-500' : t && p.currentLoad >= t.warningAt ? 'bg-amber-500' : 'bg-emerald-500';
            return (
              <div key={p.id} className="flex items-center gap-2.5 bg-secondary/20 rounded-lg px-3 py-2 border border-border min-w-[180px]">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                  {p.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{p.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${barColor}`} style={{ width: `${loadPct}%` }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">{p.currentLoad} cases</span>
                  </div>
                </div>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${getAvailabilityColor(p.availability)}`}>
                  {p.availability}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex items-center gap-1 bg-secondary/20 rounded-xl p-1 border border-border">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-widest transition-all ${
              activeSection === s.id
                ? 'bg-card text-foreground shadow-sm border border-border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className={activeSection === s.id ? 'text-primary' : 'opacity-50'}>{s.icon}</span>
            <span className="hidden sm:inline">{s.label}</span>
          </button>
        ))}
      </div>

      {/* Active section */}
      <div>
        {activeSection === 'mappings' && (
          <ServiceMappingsSection mappings={mappings} paralegals={paralegals} onChange={setMappings} />
        )}
        {activeSection === 'thresholds' && (
          <WorkloadThresholdsSection thresholds={thresholds} paralegals={paralegals} onChange={setThresholds} />
        )}
        {activeSection === 'skills' && (
          <SkillRoutingSection priorities={skillPriorities} paralegals={paralegals} onChange={setSkillPriorities} />
        )}
        {activeSection === 'accuracy' && (
          <AccuracyMetricsSection metrics={accuracyMetrics} />
        )}
      </div>
    </div>
  );
}
