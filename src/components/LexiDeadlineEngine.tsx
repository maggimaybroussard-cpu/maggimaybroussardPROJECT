'use client';

import React, { useState, useEffect } from 'react';

import toast from 'react-hot-toast';

// ── Types ─────────────────────────────────────────────────────────────────────

type DeadlineType = 'answer' | 'removal' | 'prescription_pi' | 'prescription_contract' | 'discovery_response' | 'appeal' | 'motion_response' | 'custom';
type PrescriptionType = 'personal_injury' | 'contract' | 'property_damage' | 'medical_malpractice' | 'employment' | 'fraud';

interface DeadlineRule {
  id: DeadlineType;
  label: string;
  icon: string;
  days: number;
  description: string;
  statute: string;
}

interface CalculatedDeadline {
  id: string;
  type: DeadlineType | string;
  label: string;
  triggerDate: string;
  deadlineDate: string;
  daysRemaining: number;
  statute: string;
  caseRef: string;
  clientName: string;
  notes: string;
  status: 'active' | 'expired' | 'completed';
}

const DEADLINE_RULES: DeadlineRule[] = [
  { id: 'answer', label: 'Answer to Complaint', icon: '📋', days: 21, description: 'Defendant must answer within 21 days of service (FRCP 12)', statute: 'Fed. R. Civ. P. 12(a)(1)(A)(i)' },
  { id: 'removal', label: 'Notice of Removal', icon: '🏛️', days: 30, description: '30 days from receipt of initial pleading to remove to federal court', statute: '28 U.S.C. § 1446(b)' },
  { id: 'prescription_pi', label: 'Prescription — Personal Injury (LA)', icon: '⏰', days: 365, description: '1-year prescriptive period for delictual actions in Louisiana', statute: 'La. Civ. Code art. 3492' },
  { id: 'prescription_contract', label: 'Prescription — Contract (LA)', icon: '📄', days: 3650, description: '10-year prescriptive period for personal actions in Louisiana', statute: 'La. Civ. Code art. 3499' },
  { id: 'discovery_response', label: 'Discovery Response', icon: '🔍', days: 30, description: 'Response to interrogatories, RFPs, or RFAs', statute: 'Fed. R. Civ. P. 33, 34, 36' },
  { id: 'appeal', label: 'Notice of Appeal', icon: '⚖️', days: 30, description: '30 days from entry of judgment to file notice of appeal', statute: 'Fed. R. App. P. 4(a)(1)(A)' },
  { id: 'motion_response', label: 'Response to Motion', icon: '📝', days: 21, description: '21 days to respond to a motion (local rules may vary)', statute: 'Fed. R. Civ. P. 6(d)' },
  { id: 'custom', label: 'Custom Deadline', icon: '🗓️', days: 0, description: 'Set a custom deadline with your own day count', statute: '' },
];

const PRESCRIPTION_PERIODS: Array<{ id: PrescriptionType; label: string; years: number; statute: string; warning60: boolean }> = [
  { id: 'personal_injury', label: 'Personal Injury (LA)', years: 1, statute: 'La. Civ. Code art. 3492', warning60: true },
  { id: 'contract', label: 'Contract (LA)', years: 10, statute: 'La. Civ. Code art. 3499', warning60: true },
  { id: 'property_damage', label: 'Property Damage (LA)', years: 1, statute: 'La. Civ. Code art. 3492', warning60: true },
  { id: 'medical_malpractice', label: 'Medical Malpractice (LA)', years: 3, statute: 'La. R.S. § 9:5628', warning60: true },
  { id: 'employment', label: 'Employment Discrimination', years: 1, statute: 'Title VII / 42 U.S.C. § 2000e-5(e)', warning60: true },
  { id: 'fraud', label: 'Fraud (LA)', years: 1, statute: 'La. Civ. Code art. 3492', warning60: true },
];

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function LexiDeadlineEngine() {
  const [deadlines, setDeadlines] = useState<CalculatedDeadline[]>([]);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showPrescription, setShowPrescription] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'expired'>('active');

  // Calculator form
  const [calcForm, setCalcForm] = useState({
    deadlineType: 'answer' as DeadlineType,
    triggerDate: new Date().toISOString().split('T')[0],
    clientName: '',
    caseRef: '',
    customDays: 30,
    customLabel: '',
    notes: '',
  });

  // Prescription clock form
  const [prescForm, setPrescForm] = useState({
    prescriptionType: 'personal_injury' as PrescriptionType,
    incidentDate: '',
    clientName: '',
    caseRef: '',
    notes: '',
  });

  useEffect(() => {
    loadDeadlines();
  }, []);

  const loadDeadlines = () => {
    const stored = localStorage.getItem('lexi_deadlines');
    if (stored) {
      try {
        const parsed: CalculatedDeadline[] = JSON.parse(stored);
        // Recalculate daysRemaining
        const updated = parsed.map(d => ({
          ...d,
          daysRemaining: daysUntil(d.deadlineDate),
          status: daysUntil(d.deadlineDate) < 0 ? 'expired' : d.status,
        })) as CalculatedDeadline[];
        setDeadlines(updated);
      } catch {
        setDeadlines([]);
      }
    }
  };

  const saveDeadlines = (updated: CalculatedDeadline[]) => {
    localStorage.setItem('lexi_deadlines', JSON.stringify(updated));
    setDeadlines(updated);
  };

  const addDeadline = () => {
    const rule = DEADLINE_RULES.find(r => r.id === calcForm.deadlineType)!;
    const days = calcForm.deadlineType === 'custom' ? calcForm.customDays : rule.days;
    const deadlineDate = addDays(calcForm.triggerDate, days);
    const remaining = daysUntil(deadlineDate);

    const newDeadline: CalculatedDeadline = {
      id: Date.now().toString(),
      type: calcForm.deadlineType,
      label: calcForm.deadlineType === 'custom' ? calcForm.customLabel || 'Custom Deadline' : rule.label,
      triggerDate: calcForm.triggerDate,
      deadlineDate,
      daysRemaining: remaining,
      statute: rule.statute,
      caseRef: calcForm.caseRef,
      clientName: calcForm.clientName,
      notes: calcForm.notes,
      status: remaining < 0 ? 'expired' : 'active',
    };

    const updated = [...deadlines, newDeadline].sort((a, b) => new Date(a.deadlineDate).getTime() - new Date(b.deadlineDate).getTime());
    saveDeadlines(updated);
    setShowCalculator(false);
    toast.success(`Deadline set: ${formatDate(deadlineDate)}`);
  };

  const addPrescriptionClock = () => {
    if (!prescForm.incidentDate) { toast.error('Please enter the incident date'); return; }
    const period = PRESCRIPTION_PERIODS.find(p => p.id === prescForm.prescriptionType)!;
    const deadlineDate = addDays(prescForm.incidentDate, period.years * 365);
    const remaining = daysUntil(deadlineDate);

    const newDeadline: CalculatedDeadline = {
      id: Date.now().toString(),
      type: 'prescription_' + prescForm.prescriptionType,
      label: `⏰ PRESCRIPTION CLOCK — ${period.label}`,
      triggerDate: prescForm.incidentDate,
      deadlineDate,
      daysRemaining: remaining,
      statute: period.statute,
      caseRef: prescForm.caseRef,
      clientName: prescForm.clientName,
      notes: prescForm.notes || `${period.years}-year prescriptive period. SOL expires ${formatDate(deadlineDate)}.`,
      status: remaining < 0 ? 'expired' : 'active',
    };

    const updated = [...deadlines, newDeadline].sort((a, b) => new Date(a.deadlineDate).getTime() - new Date(b.deadlineDate).getTime());
    saveDeadlines(updated);
    setShowPrescription(false);
    toast.success(`Prescription clock started — expires ${formatDate(deadlineDate)}`);
  };

  const markCompleted = (id: string) => {
    const updated = deadlines.map(d => d.id === id ? { ...d, status: 'completed' as const } : d);
    saveDeadlines(updated);
    toast.success('Deadline marked complete');
  };

  const removeDeadline = (id: string) => {
    const updated = deadlines.filter(d => d.id !== id);
    saveDeadlines(updated);
  };

  const filtered = deadlines.filter(d => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'active') return d.status === 'active';
    if (filterStatus === 'expired') return d.status === 'expired';
    return true;
  });

  const urgentCount = deadlines.filter(d => d.status === 'active' && d.daysRemaining <= 7).length;
  const soonCount = deadlines.filter(d => d.status === 'active' && d.daysRemaining > 7 && d.daysRemaining <= 30).length;

  const getUrgencyColor = (days: number, status: string) => {
    if (status === 'completed') return 'bg-green-50 border-green-200';
    if (status === 'expired') return 'bg-red-50 border-red-200';
    if (days <= 7) return 'bg-red-50 border-red-300';
    if (days <= 14) return 'bg-orange-50 border-orange-200';
    if (days <= 30) return 'bg-yellow-50 border-yellow-200';
    return 'bg-card border-border';
  };

  const getUrgencyBadge = (days: number, status: string) => {
    if (status === 'completed') return <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-semibold">✓ Done</span>;
    if (status === 'expired') return <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-[10px] font-semibold">EXPIRED</span>;
    if (days <= 0) return <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-[10px] font-semibold">TODAY</span>;
    if (days <= 7) return <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-[10px] font-semibold">🚨 {days}d</span>;
    if (days <= 14) return <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-[10px] font-semibold">⚠️ {days}d</span>;
    if (days <= 30) return <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-[10px] font-semibold">{days}d</span>;
    return <span className="px-2 py-0.5 bg-secondary text-muted-foreground rounded-full text-[10px] font-semibold">{days}d</span>;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-secondary/30 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">⏰</span>
            <div>
              <p className="text-sm font-semibold text-foreground">Smart Deadline Engine</p>
              <p className="text-[10px] text-muted-foreground">Auto-calculated deadlines, prescription clocks & SOL warnings</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setShowPrescription(true); setShowCalculator(false); }} className="px-2.5 py-1.5 bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-xs font-semibold hover:bg-amber-200 transition-colors">⏰ SOL Clock</button>
            <button onClick={() => { setShowCalculator(true); setShowPrescription(false); }} className="px-2.5 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors">+ Deadline</button>
          </div>
        </div>

        {/* Summary badges */}
        {(urgentCount > 0 || soonCount > 0) && (
          <div className="flex gap-2 mt-2">
            {urgentCount > 0 && <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-[10px] font-semibold">🚨 {urgentCount} due within 7 days</span>}
            {soonCount > 0 && <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-[10px] font-semibold">⚠️ {soonCount} due within 30 days</span>}
          </div>
        )}
      </div>

      {/* Calculator Panel */}
      {showCalculator && (
        <div className="border-b border-border bg-primary/3 p-4 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-foreground">Calculate Deadline</p>
            <button onClick={() => setShowCalculator(false)} className="text-muted-foreground hover:text-foreground text-sm">✕</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground mb-1 block">Deadline Type</label>
              <select
                value={calcForm.deadlineType}
                onChange={e => setCalcForm(f => ({ ...f, deadlineType: e.target.value as DeadlineType }))}
                className="w-full px-2 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {DEADLINE_RULES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground mb-1 block">Trigger Date</label>
              <input type="date" value={calcForm.triggerDate} onChange={e => setCalcForm(f => ({ ...f, triggerDate: e.target.value }))}
                className="w-full px-2 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground mb-1 block">Client Name</label>
              <input value={calcForm.clientName} onChange={e => setCalcForm(f => ({ ...f, clientName: e.target.value }))} placeholder="Client name"
                className="w-full px-2 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground mb-1 block">Case Ref</label>
              <input value={calcForm.caseRef} onChange={e => setCalcForm(f => ({ ...f, caseRef: e.target.value }))} placeholder="Case reference"
                className="w-full px-2 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            {calcForm.deadlineType === 'custom' && (
              <>
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground mb-1 block">Days</label>
                  <input type="number" value={calcForm.customDays} onChange={e => setCalcForm(f => ({ ...f, customDays: parseInt(e.target.value) || 0 }))}
                    className="w-full px-2 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground mb-1 block">Label</label>
                  <input value={calcForm.customLabel} onChange={e => setCalcForm(f => ({ ...f, customLabel: e.target.value }))} placeholder="Deadline label"
                    className="w-full px-2 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </>
            )}
          </div>
          {calcForm.triggerDate && (
            <div className="mt-2 p-2 bg-primary/5 rounded-lg">
              <p className="text-[10px] text-primary font-semibold">
                Deadline: {formatDate(addDays(calcForm.triggerDate, calcForm.deadlineType === 'custom' ? calcForm.customDays : (DEADLINE_RULES.find(r => r.id === calcForm.deadlineType)?.days || 0)))}
                {' '}({daysUntil(addDays(calcForm.triggerDate, calcForm.deadlineType === 'custom' ? calcForm.customDays : (DEADLINE_RULES.find(r => r.id === calcForm.deadlineType)?.days || 0)))} days from today)
              </p>
              <p className="text-[9px] text-muted-foreground mt-0.5">{DEADLINE_RULES.find(r => r.id === calcForm.deadlineType)?.statute}</p>
            </div>
          )}
          <button onClick={addDeadline} className="mt-3 w-full py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors">Add to Deadline Tracker</button>
        </div>
      )}

      {/* Prescription Clock Panel */}
      {showPrescription && (
        <div className="border-b border-border bg-amber-50 p-4 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-amber-800">⏰ Prescription / SOL Clock</p>
            <button onClick={() => setShowPrescription(false)} className="text-amber-600 hover:text-amber-800 text-sm">✕</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-amber-700 mb-1 block">Claim Type</label>
              <select value={prescForm.prescriptionType} onChange={e => setPrescForm(f => ({ ...f, prescriptionType: e.target.value as PrescriptionType }))}
                className="w-full px-2 py-1.5 bg-white border border-amber-200 rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-amber-300">
                {PRESCRIPTION_PERIODS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-amber-700 mb-1 block">Date of Incident</label>
              <input type="date" value={prescForm.incidentDate} onChange={e => setPrescForm(f => ({ ...f, incidentDate: e.target.value }))}
                className="w-full px-2 py-1.5 bg-white border border-amber-200 rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-amber-300" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-amber-700 mb-1 block">Client Name</label>
              <input value={prescForm.clientName} onChange={e => setPrescForm(f => ({ ...f, clientName: e.target.value }))} placeholder="Client name"
                className="w-full px-2 py-1.5 bg-white border border-amber-200 rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-300" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-amber-700 mb-1 block">Case Ref</label>
              <input value={prescForm.caseRef} onChange={e => setPrescForm(f => ({ ...f, caseRef: e.target.value }))} placeholder="Case reference"
                className="w-full px-2 py-1.5 bg-white border border-amber-200 rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-300" />
            </div>
          </div>
          {prescForm.incidentDate && (
            <div className="mt-2 p-2 bg-amber-100 rounded-lg border border-amber-200">
              <p className="text-[10px] text-amber-800 font-semibold">
                SOL Expires: {formatDate(addDays(prescForm.incidentDate, (PRESCRIPTION_PERIODS.find(p => p.id === prescForm.prescriptionType)?.years || 1) * 365))}
                {' '}({daysUntil(addDays(prescForm.incidentDate, (PRESCRIPTION_PERIODS.find(p => p.id === prescForm.prescriptionType)?.years || 1) * 365))} days remaining)
              </p>
              <p className="text-[9px] text-amber-700 mt-0.5">{PRESCRIPTION_PERIODS.find(p => p.id === prescForm.prescriptionType)?.statute}</p>
            </div>
          )}
          <button onClick={addPrescriptionClock} className="mt-3 w-full py-2 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 transition-colors">Start Prescription Clock</button>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex border-b border-border shrink-0">
        {(['all', 'active', 'expired'] as const).map(f => (
          <button key={f} onClick={() => setFilterStatus(f)}
            className={`flex-1 py-2 text-xs font-semibold capitalize transition-colors ${filterStatus === f ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            {f} ({f === 'all' ? deadlines.length : deadlines.filter(d => d.status === f).length})
          </button>
        ))}
      </div>

      {/* Deadline list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <span className="text-3xl mb-2">⏰</span>
            <p className="text-sm font-semibold text-foreground">No deadlines tracked</p>
            <p className="text-xs text-muted-foreground mt-1">Add a deadline or start a prescription clock above</p>
          </div>
        ) : (
          filtered.map(deadline => (
            <div key={deadline.id} className={`border rounded-xl p-3 ${getUrgencyColor(deadline.daysRemaining, deadline.status)}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {getUrgencyBadge(deadline.daysRemaining, deadline.status)}
                    <p className="text-xs font-semibold text-foreground truncate">{deadline.label}</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Due: <span className="font-semibold text-foreground">{formatDate(deadline.deadlineDate)}</span>
                    {deadline.clientName && <span className="ml-2">· {deadline.clientName}</span>}
                    {deadline.caseRef && <span className="ml-1">({deadline.caseRef})</span>}
                  </p>
                  {deadline.statute && <p className="text-[9px] text-muted-foreground mt-0.5">{deadline.statute}</p>}
                  {deadline.notes && <p className="text-[10px] text-muted-foreground mt-1 italic">{deadline.notes}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  {deadline.status === 'active' && (
                    <button onClick={() => markCompleted(deadline.id)} className="px-2 py-1 bg-green-100 text-green-700 rounded-lg text-[10px] font-semibold hover:bg-green-200 transition-colors">✓</button>
                  )}
                  <button onClick={() => removeDeadline(deadline.id)} className="px-2 py-1 bg-secondary text-muted-foreground rounded-lg text-[10px] hover:bg-red-100 hover:text-red-600 transition-colors">✕</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
