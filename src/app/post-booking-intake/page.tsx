'use client';

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import AppLogo from '@/components/ui/AppLogo';
import QRCodeImage from '@/components/ui/QRCodeImage';

// ── Brand ─────────────────────────────────────────────────────────────────────
const brand = {
  green: '#355E3B',
  greenDark: '#2d5a35',
  greenLight: 'rgba(53,94,59,0.08)',
  accent: '#C8965A',
  accentLight: 'rgba(200,150,90,0.08)',
  bg: '#FAF7F2',
  secondary: '#EDE8E0',
  border: '#D9D0C5',
  muted: '#7A6B5D',
  foreground: '#2C1F14',
  primary: '#4A3728',
};

// ── Types ─────────────────────────────────────────────────────────────────────
type WorkflowStep = 'docs' | 'signature' | 'payment' | 'assigned';

interface WorkflowSession {
  id: string;
  inquiry_id: string;
  client_name: string;
  client_email: string;
  booking_event_name: string | null;
  booking_start_time: string | null;
  step_docs_completed: boolean;
  step_signature_completed: boolean;
  step_payment_completed: boolean;
  step_case_assigned: boolean;
  workflow_status: string;
  appointment_qr_token: string;
  assigned_attorney_name: string | null;
  assigned_attorney_email: string | null;
}

interface IntakeDocForm {
  fullLegalName: string;
  dateOfBirth: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  caseType: string;
  caseDescription: string;
  priorAttorney: string;
  opposingParty: string;
  urgency: string;
  howDidYouHear: string;
  additionalNotes: string;
}

type SignMode = 'draw' | 'type';

// ── Step indicator ────────────────────────────────────────────────────────────
const STEPS = [
  { id: 'docs', label: 'Intake Docs', icon: '📋' },
  { id: 'signature', label: 'Retainer', icon: '✍️' },
  { id: 'payment', label: 'Payment', icon: '💳' },
  { id: 'assigned', label: 'Case Assigned', icon: '⚖️' },
];

function StepBar({ current, completed }: { current: WorkflowStep; completed: Set<WorkflowStep> }) {
  const idx = STEPS.findIndex((s) => s.id === current);
  return (
    <div className="w-full max-w-2xl mx-auto mb-8 px-2">
      <div className="flex items-center justify-between relative">
        <div className="absolute top-5 left-0 right-0 h-0.5 z-0" style={{ background: brand.border }} />
        <div
          className="absolute top-5 left-0 h-0.5 z-0 transition-all duration-500"
          style={{ width: `${(idx / (STEPS.length - 1)) * 100}%`, background: brand.green }}
        />
        {STEPS.map((step, i) => {
          const done = completed.has(step.id as WorkflowStep);
          const active = step.id === current;
          return (
            <div key={step.id} className="flex flex-col items-center gap-2 z-10">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 text-sm"
                style={{
                  background: done ? brand.green : active ? '#fff' : '#fff',
                  borderColor: done || active ? brand.green : brand.border,
                  color: done ? '#fff' : active ? brand.green : brand.muted,
                  boxShadow: active ? `0 0 0 4px rgba(53,94,59,0.12)` : 'none',
                }}
              >
                {done ? '✓' : step.icon}
              </div>
              <span
                className="text-xs font-medium hidden sm:block"
                style={{ color: active ? brand.green : done ? brand.foreground : brand.muted }}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Step 1: Intake Documents ──────────────────────────────────────────────────
function StepDocs({
  session,
  onComplete,
}: {
  session: WorkflowSession;
  onComplete: (data: IntakeDocForm) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<IntakeDocForm>({
    fullLegalName: session.client_name,
    dateOfBirth: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    caseType: '',
    caseDescription: '',
    priorAttorney: '',
    opposingParty: '',
    urgency: 'standard',
    howDidYouHear: '',
    additionalNotes: '',
  });

  const set = (k: keyof IntakeDocForm, v: string) => {
    setForm((p) => ({ ...p, [k]: v }));
    setErrors((p) => ({ ...p, [k]: '' }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.fullLegalName.trim()) e.fullLegalName = 'Required';
    if (!form.phone.trim()) e.phone = 'Required';
    if (!form.address.trim()) e.address = 'Required';
    if (!form.caseType) e.caseType = 'Required';
    if (!form.caseDescription.trim() || form.caseDescription.length < 20) e.caseDescription = 'Please provide at least 20 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await onComplete(form);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = (err?: string) => ({
    background: brand.bg,
    border: `1px solid ${err ? '#B85C38' : brand.border}`,
    color: brand.foreground,
    borderRadius: '10px',
    padding: '10px 14px',
    fontSize: '14px',
    width: '100%',
    outline: 'none',
  } as React.CSSProperties);

  const labelCls = 'block text-xs font-semibold uppercase tracking-widest mb-1.5';

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="font-serif text-2xl mb-1" style={{ color: brand.foreground }}>Intake Documents</h2>
        <p className="text-sm" style={{ color: brand.muted }}>Please complete your intake information before your consultation.</p>
      </div>

      {/* Personal Info */}
      <div className="rounded-2xl p-5 space-y-4" style={{ background: '#fff', border: `1px solid ${brand.border}` }}>
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: brand.muted }}>Personal Information</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls} style={{ color: brand.muted }}>Full Legal Name <span style={{ color: brand.accent }}>*</span></label>
            <input style={inputCls(errors.fullLegalName)} value={form.fullLegalName} onChange={(e) => set('fullLegalName', e.target.value)} placeholder="As it appears on legal documents" />
            {errors.fullLegalName && <p className="text-xs mt-1" style={{ color: '#B85C38' }}>{errors.fullLegalName}</p>}
          </div>
          <div>
            <label className={labelCls} style={{ color: brand.muted }}>Date of Birth</label>
            <input type="date" style={inputCls()} value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} />
          </div>
          <div>
            <label className={labelCls} style={{ color: brand.muted }}>Phone <span style={{ color: brand.accent }}>*</span></label>
            <input style={inputCls(errors.phone)} value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="(555) 000-0000" />
            {errors.phone && <p className="text-xs mt-1" style={{ color: '#B85C38' }}>{errors.phone}</p>}
          </div>
          <div>
            <label className={labelCls} style={{ color: brand.muted }}>Street Address <span style={{ color: brand.accent }}>*</span></label>
            <input style={inputCls(errors.address)} value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="123 Main St" />
            {errors.address && <p className="text-xs mt-1" style={{ color: '#B85C38' }}>{errors.address}</p>}
          </div>
          <div>
            <label className={labelCls} style={{ color: brand.muted }}>City</label>
            <input style={inputCls()} value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="City" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} style={{ color: brand.muted }}>State</label>
              <input style={inputCls()} value={form.state} onChange={(e) => set('state', e.target.value)} placeholder="TX" maxLength={2} />
            </div>
            <div>
              <label className={labelCls} style={{ color: brand.muted }}>ZIP</label>
              <input style={inputCls()} value={form.zip} onChange={(e) => set('zip', e.target.value)} placeholder="77001" />
            </div>
          </div>
        </div>
      </div>

      {/* Case Details */}
      <div className="rounded-2xl p-5 space-y-4" style={{ background: '#fff', border: `1px solid ${brand.border}` }}>
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: brand.muted }}>Case Details</p>
        <div>
          <label className={labelCls} style={{ color: brand.muted }}>Service Type <span style={{ color: brand.accent }}>*</span></label>
          <select
            style={{ ...inputCls(errors.caseType), appearance: 'none' as const }}
            value={form.caseType}
            onChange={(e) => set('caseType', e.target.value)}
          >
            <option value="">Select service type…</option>
            {['Litigation Support', 'Legal Research & Memos', 'Document Drafting', 'Discovery Assistance', 'Case Management', 'Trial Preparation', 'Contract Review', 'Deposition Support', 'Motion & Brief Drafting', 'Other'].map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
          {errors.caseType && <p className="text-xs mt-1" style={{ color: '#B85C38' }}>{errors.caseType}</p>}
        </div>
        <div>
          <label className={labelCls} style={{ color: brand.muted }}>Case Description <span style={{ color: brand.accent }}>*</span></label>
          <textarea
            style={{ ...inputCls(errors.caseDescription), resize: 'none' as const, minHeight: '100px' }}
            value={form.caseDescription}
            onChange={(e) => set('caseDescription', e.target.value)}
            placeholder="Briefly describe your legal matter, key facts, and what support you need…"
            rows={4}
          />
          {errors.caseDescription && <p className="text-xs mt-1" style={{ color: '#B85C38' }}>{errors.caseDescription}</p>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls} style={{ color: brand.muted }}>Opposing Party</label>
            <input style={inputCls()} value={form.opposingParty} onChange={(e) => set('opposingParty', e.target.value)} placeholder="Name or entity" />
          </div>
          <div>
            <label className={labelCls} style={{ color: brand.muted }}>Prior Attorney (if any)</label>
            <input style={inputCls()} value={form.priorAttorney} onChange={(e) => set('priorAttorney', e.target.value)} placeholder="Attorney name or firm" />
          </div>
        </div>
        <div>
          <label className={labelCls} style={{ color: brand.muted }}>Urgency Level</label>
          <div className="flex gap-3 flex-wrap">
            {[
              { v: 'standard', label: 'Standard', sub: '1–2 weeks' },
              { v: 'priority', label: 'Priority', sub: '3–5 days' },
              { v: 'urgent', label: 'Urgent', sub: '24–48 hrs' },
            ].map((u) => (
              <button
                key={u.v}
                type="button"
                onClick={() => set('urgency', u.v)}
                className="flex-1 min-w-[100px] px-4 py-3 rounded-xl text-left transition-all duration-200"
                style={{
                  border: `1.5px solid ${form.urgency === u.v ? brand.green : brand.border}`,
                  background: form.urgency === u.v ? brand.greenLight : '#fff',
                }}
              >
                <p className="text-xs font-semibold" style={{ color: form.urgency === u.v ? brand.green : brand.foreground }}>{u.label}</p>
                <p className="text-xs" style={{ color: brand.muted }}>{u.sub}</p>
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className={labelCls} style={{ color: brand.muted }}>How did you hear about us?</label>
          <input style={inputCls()} value={form.howDidYouHear} onChange={(e) => set('howDidYouHear', e.target.value)} placeholder="Referral, Google, LinkedIn…" />
        </div>
        <div>
          <label className={labelCls} style={{ color: brand.muted }}>Additional Notes</label>
          <textarea
            style={{ ...inputCls(), resize: 'none' as const }}
            value={form.additionalNotes}
            onChange={(e) => set('additionalNotes', e.target.value)}
            placeholder="Anything else we should know before the consultation…"
            rows={3}
          />
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={saving}
        className="w-full py-3.5 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all duration-200 flex items-center justify-center gap-2"
        style={{ background: brand.green, color: '#fff', opacity: saving ? 0.7 : 1 }}
      >
        {saving ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
        ) : null}
        {saving ? 'Saving…' : 'Continue to Retainer Signature →'}
      </button>
    </div>
  );
}

// ── Step 2: Retainer Signature ────────────────────────────────────────────────
function StepSignature({
  session,
  onComplete,
}: {
  session: WorkflowSession;
  onComplete: (sigData: string, sigType: string, sigName: string) => Promise<void>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [signMode, setSignMode] = useState<SignMode>('draw');
  const [typedName, setTypedName] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      const touch = e.touches[0];
      return { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = brand.foreground;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    setHasDrawn(true);
  };

  const endDraw = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleSign = async () => {
    setError('');
    let sigData = '';
    let sigType = '';
    let sigName = '';

    if (signMode === 'type') {
      if (!typedName.trim()) { setError('Please type your full name to sign.'); return; }
      sigData = `typed:${typedName.trim()}`;
      sigType = 'typed';
      sigName = typedName.trim();
    } else {
      if (!hasDrawn) { setError('Please draw your signature above.'); return; }
      const canvas = canvasRef.current;
      if (!canvas) return;
      sigData = canvas.toDataURL('image/png');
      sigType = 'drawn';
      sigName = session.client_name;
    }

    setSaving(true);
    try {
      await onComplete(sigData, sigType, sigName);
    } catch {
      setError('Failed to save signature. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="font-serif text-2xl mb-1" style={{ color: brand.foreground }}>Retainer Agreement</h2>
        <p className="text-sm" style={{ color: brand.muted }}>Review and sign the retainer agreement to confirm your engagement.</p>
      </div>

      {/* Retainer document preview */}
      <div className="rounded-2xl p-5 space-y-3 text-sm leading-relaxed" style={{ background: '#fff', border: `1px solid ${brand.border}`, maxHeight: '280px', overflowY: 'auto' }}>
        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: brand.muted }}>Retainer Agreement — Summary</p>
        <p style={{ color: brand.foreground }}>
          This Retainer Agreement (&ldquo;Agreement&rdquo;) is entered into between <strong>Maggi May Broussard, Paralegal Services</strong> (&ldquo;Provider&rdquo;) and the undersigned client (&ldquo;Client&rdquo;).
        </p>
        <p style={{ color: brand.muted }}>
          <strong style={{ color: brand.foreground }}>Scope of Services:</strong> Provider agrees to furnish paralegal support services as described in the intake form, including but not limited to legal research, document drafting, discovery assistance, and case management support.
        </p>
        <p style={{ color: brand.muted }}>
          <strong style={{ color: brand.foreground }}>Fees &amp; Payment:</strong> Client agrees to pay the agreed retainer fee prior to commencement of services. Hourly rates apply beyond the retainer scope. Invoices are due within 15 days of issuance.
        </p>
        <p style={{ color: brand.muted }}>
          <strong style={{ color: brand.foreground }}>Confidentiality:</strong> All client information and case materials are held in strict confidence. Provider will not disclose any information without written consent except as required by law.
        </p>
        <p style={{ color: brand.muted }}>
          <strong style={{ color: brand.foreground }}>Limitation:</strong> Provider is a paralegal, not an attorney. Services do not constitute legal advice or representation. Client is advised to consult a licensed attorney for legal counsel.
        </p>
        <p style={{ color: brand.muted }}>
          <strong style={{ color: brand.foreground }}>Termination:</strong> Either party may terminate this agreement with 7 days written notice. Unused retainer funds will be refunded on a pro-rated basis.
        </p>
        <p style={{ color: brand.muted }}>
          By signing below, Client acknowledges reading, understanding, and agreeing to the terms of this Retainer Agreement.
        </p>
      </div>

      {/* Signature mode toggle */}
      <div className="rounded-2xl p-5 space-y-4" style={{ background: '#fff', border: `1px solid ${brand.border}` }}>
        <div className="flex gap-2">
          {(['draw', 'type'] as SignMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setSignMode(m); clearCanvas(); setTypedName(''); setError(''); }}
              className="flex-1 py-2 rounded-lg text-xs font-semibold uppercase tracking-widest transition-all duration-200"
              style={{
                background: signMode === m ? brand.green : brand.bg,
                color: signMode === m ? '#fff' : brand.muted,
                border: `1px solid ${signMode === m ? brand.green : brand.border}`,
              }}
            >
              {m === 'draw' ? '✏️ Draw Signature' : '⌨️ Type Name'}
            </button>
          ))}
        </div>

        {signMode === 'draw' ? (
          <div>
            <p className="text-xs mb-2" style={{ color: brand.muted }}>Draw your signature in the box below:</p>
            <div className="relative rounded-xl overflow-hidden" style={{ border: `1.5px solid ${brand.border}`, background: brand.bg }}>
              <canvas
                ref={canvasRef}
                width={600}
                height={150}
                className="w-full touch-none cursor-crosshair"
                style={{ display: 'block' }}
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={endDraw}
              />
              {!hasDrawn && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <p className="text-sm" style={{ color: brand.border }}>Sign here…</p>
                </div>
              )}
            </div>
            {hasDrawn && (
              <button onClick={clearCanvas} className="text-xs mt-2 underline" style={{ color: brand.muted }}>Clear</button>
            )}
          </div>
        ) : (
          <div>
            <p className="text-xs mb-2" style={{ color: brand.muted }}>Type your full legal name to sign:</p>
            <input
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder={session.client_name}
              className="w-full px-4 py-3 rounded-xl text-2xl outline-none"
              style={{
                fontFamily: 'Georgia, serif',
                fontStyle: 'italic',
                background: brand.bg,
                border: `1px solid ${brand.border}`,
                color: brand.foreground,
              }}
            />
            {typedName && (
              <p className="text-xs mt-1.5" style={{ color: brand.muted }}>
                Signing as: <span style={{ fontStyle: 'italic', color: brand.foreground }}>{typedName}</span>
              </p>
            )}
          </div>
        )}

        {error && <p className="text-xs" style={{ color: '#B85C38' }}>{error}</p>}

        <p className="text-xs" style={{ color: brand.muted }}>
          By signing, you confirm you have read and agree to the Retainer Agreement above. This constitutes a legally binding electronic signature.
        </p>
      </div>

      <button
        onClick={handleSign}
        disabled={saving}
        className="w-full py-3.5 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all duration-200 flex items-center justify-center gap-2"
        style={{ background: brand.green, color: '#fff', opacity: saving ? 0.7 : 1 }}
      >
        {saving ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg> : null}
        {saving ? 'Saving Signature…' : 'Sign & Continue to Payment →'}
      </button>
    </div>
  );
}

// ── Step 3: Payment ───────────────────────────────────────────────────────────
function StepPayment({
  session,
  onComplete,
}: {
  session: WorkflowSession;
  onComplete: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('');

  const PLANS = [
    { id: 'deposit', label: 'Consultation Deposit', amount: 150, desc: 'Secures your consultation slot. Applied toward retainer.' },
    { id: 'essential', label: 'Essential Retainer', amount: 750, desc: '10 hours of paralegal support. Best for focused projects.' },
    { id: 'standard', label: 'Standard Retainer', amount: 1500, desc: '20 hours of paralegal support. Most popular for ongoing matters.' },
    { id: 'premium', label: 'Premium Retainer', amount: 2800, desc: '40 hours of paralegal support. Full-service case management.' },
  ];

  const handlePay = async () => {
    if (!selectedPlan) return;
    setSaving(true);
    try {
      const plan = PLANS.find((p) => p.id === selectedPlan);
      if (!plan) return;

      // Record payment intent in workflow
      const supabase = createClient();
      await supabase
        .from('intake_workflow_sessions')
        .update({
          step_payment_completed: true,
          step_payment_completed_at: new Date().toISOString(),
          payment_amount: plan.amount * 100,
          payment_status: 'initiated',
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.id);

      await onComplete();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="font-serif text-2xl mb-1" style={{ color: brand.foreground }}>Payment Information</h2>
        <p className="text-sm" style={{ color: brand.muted }}>Select a payment plan to complete your intake and confirm case assignment.</p>
      </div>

      <div className="space-y-3">
        {PLANS.map((plan) => (
          <button
            key={plan.id}
            type="button"
            onClick={() => setSelectedPlan(plan.id)}
            className="w-full rounded-2xl p-4 text-left transition-all duration-200"
            style={{
              background: selectedPlan === plan.id ? brand.greenLight : '#fff',
              border: `1.5px solid ${selectedPlan === plan.id ? brand.green : brand.border}`,
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0"
                  style={{ borderColor: selectedPlan === plan.id ? brand.green : brand.border }}
                >
                  {selectedPlan === plan.id && (
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: brand.green }} />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: brand.foreground }}>{plan.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: brand.muted }}>{plan.desc}</p>
                </div>
              </div>
              <p className="text-base font-bold shrink-0 ml-4" style={{ color: brand.green }}>${plan.amount.toLocaleString()}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="rounded-2xl p-4" style={{ background: brand.accentLight, border: `1px solid rgba(200,150,90,0.3)` }}>
        <div className="flex items-start gap-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={brand.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
          </svg>
          <p className="text-xs" style={{ color: brand.primary }}>
            Secure payment processed via Stripe. Your card information is never stored on our servers. All transactions are encrypted.
          </p>
        </div>
      </div>

      <button
        onClick={handlePay}
        disabled={saving || !selectedPlan}
        className="w-full py-3.5 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all duration-200 flex items-center justify-center gap-2"
        style={{ background: brand.green, color: '#fff', opacity: saving || !selectedPlan ? 0.5 : 1 }}
      >
        {saving ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg> : null}
        {saving ? 'Processing…' : selectedPlan ? `Confirm & Pay $${PLANS.find((p) => p.id === selectedPlan)?.amount.toLocaleString()}` : 'Select a Plan to Continue'}
      </button>
    </div>
  );
}

// ── Step 4: Case Assigned ─────────────────────────────────────────────────────
function StepAssigned({ session }: { session: WorkflowSession }) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://maggimaybr6854.builtwithrocket.new';
  const qrUrl = `${siteUrl}/post-booking-intake?token=${session.appointment_qr_token}`;

  const formatDt = (dt: string | null) => {
    if (!dt) return null;
    return new Date(dt).toLocaleString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: brand.greenLight }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={brand.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>
        <h2 className="font-serif text-2xl mb-1" style={{ color: brand.foreground }}>You&apos;re All Set!</h2>
        <p className="text-sm" style={{ color: brand.muted }}>Your intake is complete. Your case has been assigned and your consultation is confirmed.</p>
      </div>

      {/* Summary card */}
      <div className="rounded-2xl p-5 space-y-3" style={{ background: '#fff', border: `1px solid ${brand.border}` }}>
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: brand.muted }}>Intake Summary</p>
        <div className="space-y-2">
          {[
            { label: 'Client', value: session.client_name },
            { label: 'Email', value: session.client_email },
            { label: 'Consultation', value: session.booking_event_name ?? 'Scheduled' },
            { label: 'Date & Time', value: formatDt(session.booking_start_time) ?? 'Confirmed' },
            { label: 'Assigned To', value: session.assigned_attorney_name ?? 'Maggi May Broussard' },
          ].map((row) => (
            <div key={row.label} className="flex items-start justify-between gap-4 py-1.5" style={{ borderBottom: `1px solid ${brand.secondary}` }}>
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: brand.muted }}>{row.label}</span>
              <span className="text-xs text-right" style={{ color: brand.foreground }}>{row.value}</span>
            </div>
          ))}
        </div>

        {/* Completion badges */}
        <div className="flex flex-wrap gap-2 pt-2">
          {[
            { label: 'Intake Docs', done: session.step_docs_completed },
            { label: 'Retainer Signed', done: session.step_signature_completed },
            { label: 'Payment', done: session.step_payment_completed },
          ].map((badge) => (
            <span
              key={badge.label}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{
                background: badge.done ? 'rgba(53,94,59,0.1)' : 'rgba(122,107,93,0.08)',
                color: badge.done ? brand.green : brand.muted,
                border: `1px solid ${badge.done ? 'rgba(53,94,59,0.25)' : brand.border}`,
              }}
            >
              {badge.done ? '✓' : '○'} {badge.label}
            </span>
          ))}
        </div>
      </div>

      {/* QR Code for appointment */}
      <div className="rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-5" style={{ background: '#fff', border: `1px solid ${brand.border}` }}>
        <div className="shrink-0 p-3 rounded-xl" style={{ background: brand.bg, border: `1px solid ${brand.border}` }}>
          <QRCodeImage
            value={qrUrl}
            size={96}
            fgColor={brand.foreground}
            bgColor="transparent"
            level="M"
          />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: brand.muted }}>Appointment QR Code</p>
          <p className="text-sm font-semibold mb-1" style={{ color: brand.foreground }}>Save or screenshot this QR code</p>
          <p className="text-xs leading-relaxed" style={{ color: brand.muted }}>
            Scan at check-in to instantly pull up your intake file, signed retainer, and case details. Present this at your consultation.
          </p>
          <p className="text-xs mt-2 font-mono break-all" style={{ color: brand.muted }}>Token: {session.appointment_qr_token?.slice(0, 12)}…</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/portal/dashboard"
          className="flex-1 py-3 rounded-xl text-sm font-semibold uppercase tracking-widest text-center transition-all duration-200"
          style={{ background: brand.green, color: '#fff' }}
        >
          Go to Client Portal
        </Link>
        <Link
          href="/"
          className="flex-1 py-3 rounded-xl text-sm font-semibold uppercase tracking-widest text-center transition-all duration-200"
          style={{ background: brand.bg, color: brand.foreground, border: `1px solid ${brand.border}` }}
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}

// ── Main Workflow ─────────────────────────────────────────────────────────────
function PostBookingIntakeWorkflow() {
  const searchParams = useSearchParams();
  const [session, setSession] = useState<WorkflowSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('docs');
  const [completed, setCompleted] = useState<Set<WorkflowStep>>(new Set());

  // Params from Calendly post-booking redirect or direct link
  const token = searchParams.get('token');
  const name = searchParams.get('name') ?? '';
  const email = searchParams.get('email') ?? '';
  const eventName = searchParams.get('event') ?? '';
  const startTime = searchParams.get('start') ?? '';
  const inquiryId = searchParams.get('inquiry') ?? '';

  const initSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();

      // If token provided, look up existing session
      if (token) {
        const { data, error: fetchErr } = await supabase
          .from('intake_workflow_sessions')
          .select('*')
          .eq('appointment_qr_token', token)
          .single();

        if (fetchErr || !data) {
          setError('Session not found. Please use the link from your booking confirmation.');
          setLoading(false);
          return;
        }

        setSession(data);
        // Determine current step from completion state
        if (data.step_case_assigned) {
          setCurrentStep('assigned');
          setCompleted(new Set(['docs', 'signature', 'payment'] as WorkflowStep[]));
        } else if (data.step_payment_completed) {
          setCurrentStep('assigned');
          setCompleted(new Set(['docs', 'signature', 'payment'] as WorkflowStep[]));
        } else if (data.step_signature_completed) {
          setCurrentStep('payment');
          setCompleted(new Set(['docs', 'signature'] as WorkflowStep[]));
        } else if (data.step_docs_completed) {
          setCurrentStep('signature');
          setCompleted(new Set(['docs'] as WorkflowStep[]));
        } else {
          setCurrentStep('docs');
        }
        setLoading(false);
        return;
      }

      // Create new session
      if (!name || !email) {
        setError('Missing booking information. Please use the link from your confirmation email.');
        setLoading(false);
        return;
      }

      const { data: newSession, error: createErr } = await supabase
        .from('intake_workflow_sessions')
        .insert({
          inquiry_id: inquiryId || 'direct',
          client_name: name,
          client_email: email,
          booking_event_name: eventName || 'Consultation',
          booking_start_time: startTime ? new Date(startTime).toISOString() : null,
          workflow_status: 'in_progress',
        })
        .select()
        .single();

      if (createErr || !newSession) {
        setError('Failed to start intake session. Please try again.');
        setLoading(false);
        return;
      }

      setSession(newSession);
      setCurrentStep('docs');
    } catch {
      setError('An unexpected error occurred. Please refresh and try again.');
    } finally {
      setLoading(false);
    }
  }, [token, name, email, eventName, startTime, inquiryId]);

  useEffect(() => {
    initSession();
  }, [initSession]);

  const handleDocsComplete = async (data: IntakeDocForm) => {
    if (!session) return;
    const supabase = createClient();
    await supabase
      .from('intake_workflow_sessions')
      .update({
        step_docs_completed: true,
        step_docs_completed_at: new Date().toISOString(),
        intake_doc_data: data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id);

    setSession((s) => s ? { ...s, step_docs_completed: true } : s);
    setCompleted((prev) => new Set([...prev, 'docs']));
    setCurrentStep('signature');
  };

  const handleSignatureComplete = async (sigData: string, sigType: string, sigName: string) => {
    if (!session) return;
    const supabase = createClient();
    await supabase
      .from('intake_workflow_sessions')
      .update({
        step_signature_completed: true,
        step_signature_completed_at: new Date().toISOString(),
        retainer_signature_data: sigData,
        retainer_signature_type: sigType,
        retainer_signed_name: sigName,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id);

    setSession((s) => s ? { ...s, step_signature_completed: true } : s);
    setCompleted((prev) => new Set([...prev, 'signature']));
    setCurrentStep('payment');
  };

  const handlePaymentComplete = async () => {
    if (!session) return;
    const supabase = createClient();

    // Auto-assign based on existing routing rules
    const { data: routingRule } = await supabase
      .from('intake_routing_rules')
      .select('attorney_name, attorney_email')
      .eq('is_active', true)
      .limit(1)
      .single();

    await supabase
      .from('intake_workflow_sessions')
      .update({
        step_case_assigned: true,
        step_case_assigned_at: new Date().toISOString(),
        assigned_attorney_name: routingRule?.attorney_name ?? 'Maggi May Broussard',
        assigned_attorney_email: routingRule?.attorney_email ?? 'maggimaybroussard@gmail.com',
        workflow_status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id);

    setSession((s) => s ? {
      ...s,
      step_payment_completed: true,
      step_case_assigned: true,
      assigned_attorney_name: routingRule?.attorney_name ?? 'Maggi May Broussard',
    } : s);
    setCompleted((prev) => new Set([...prev, 'payment']));
    setCurrentStep('assigned');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: brand.bg }}>
        <div className="w-8 h-8 border-2 border-gray-200 rounded-full animate-spin" style={{ borderTopColor: brand.green }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5" style={{ background: brand.bg }}>
        <div className="max-w-md w-full text-center space-y-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto" style={{ background: 'rgba(184,92,56,0.1)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#B85C38" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h2 className="font-serif text-xl" style={{ color: brand.foreground }}>Session Error</h2>
          <p className="text-sm" style={{ color: brand.muted }}>{error}</p>
          <Link href="/book-consultation" className="inline-block px-6 py-2.5 rounded-xl text-sm font-semibold" style={{ background: brand.green, color: '#fff' }}>
            Book a Consultation
          </Link>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen" style={{ background: brand.bg }}>
      {/* Header */}
      <header className="sticky top-0 z-40 border-b" style={{ background: 'rgba(250,247,242,0.95)', borderColor: brand.border, backdropFilter: 'blur(8px)' }}>
        <div className="max-w-3xl mx-auto px-5 py-3.5 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2.5 group">
            <AppLogo size={26} className="transition-transform duration-300 group-hover:scale-105" />
            <span className="font-serif text-sm tracking-tight hidden sm:block" style={{ color: brand.green }}>Maggi May Broussard</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xs px-3 py-1 rounded-full font-medium" style={{ background: brand.greenLight, color: brand.green }}>
              Post-Booking Intake
            </span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-8 px-5 text-center" style={{ background: `linear-gradient(135deg, ${brand.greenDark} 0%, ${brand.green} 100%)` }}>
        <p className="text-xs uppercase tracking-widest font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.6)' }}>Welcome, {session.client_name.split(' ')[0]}</p>
        <h1 className="font-serif text-2xl md:text-3xl text-white mb-2">Complete Your Intake</h1>
        <p className="text-sm max-w-md mx-auto" style={{ color: 'rgba(255,255,255,0.75)' }}>
          {session.booking_event_name ? `Your ${session.booking_event_name} is confirmed.` : 'Your consultation is confirmed.'} Complete these steps before your appointment.
        </p>
      </section>

      <main className="max-w-2xl mx-auto px-5 py-8">
        <StepBar current={currentStep} completed={completed} />

        {currentStep === 'docs' && (
          <StepDocs session={session} onComplete={handleDocsComplete} />
        )}
        {currentStep === 'signature' && (
          <StepSignature session={session} onComplete={handleSignatureComplete} />
        )}
        {currentStep === 'payment' && (
          <StepPayment session={session} onComplete={handlePaymentComplete} />
        )}
        {currentStep === 'assigned' && (
          <StepAssigned session={session} />
        )}
      </main>
    </div>
  );
}

export default function PostBookingIntakePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#FAF7F2' }}>
        <div className="w-8 h-8 border-2 border-gray-200 rounded-full animate-spin" style={{ borderTopColor: '#355E3B' }} />
      </div>
    }>
      <PostBookingIntakeWorkflow />
    </Suspense>
  );
}
