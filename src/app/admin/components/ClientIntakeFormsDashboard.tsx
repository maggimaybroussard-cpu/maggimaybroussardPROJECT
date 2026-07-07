'use client';

import React, { useState, useEffect, useCallback } from 'react';

import toast from 'react-hot-toast';

// ── Types ─────────────────────────────────────────────────────────────────────

interface IntakeSubmission {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  service_type: string | null;
  matter_description: string | null;
  opposing_party: string | null;
  incident_date: string | null;
  urgency: 'urgent' | 'high' | 'normal' | 'low';
  preferred_contact: string | null;
  referral_source: string | null;
  prior_attorney: boolean;
  prior_attorney_details: string | null;
  status: 'new' | 'reviewed' | 'scheduled' | 'declined' | 'converted';
  admin_notes: string | null;
  created_at: string;
}

const URGENCY_COLORS: Record<string, string> = {
  urgent: 'bg-red-50 text-red-700 border-red-200',
  high: 'bg-orange-50 text-orange-700 border-orange-200',
  normal: 'bg-blue-50 text-blue-700 border-blue-200',
  low: 'bg-gray-100 text-gray-600 border-gray-200',
};

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-50 text-blue-700 border-blue-200',
  reviewed: 'bg-amber-50 text-amber-700 border-amber-200',
  scheduled: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  declined: 'bg-red-50 text-red-700 border-red-200',
  converted: 'bg-purple-50 text-purple-700 border-purple-200',
};

const SERVICE_TYPES = [
  'Business Law',
  'Civil Litigation',
  'Contract Disputes',
  'Employment Law',
  'Estate Planning',
  'Family Law',
  'Immigration',
  'Intellectual Property',
  'Personal Injury',
  'Real Estate',
  'Criminal Defense',
  'Other',
];

// ── Mock data for demo ────────────────────────────────────────────────────────

const MOCK_SUBMISSIONS: IntakeSubmission[] = [
  {
    id: '1',
    name: 'Marcus Johnson',
    email: 'marcus.j@email.com',
    phone: '(504) 555-0192',
    service_type: 'Business Law',
    matter_description: 'Partnership dispute with co-founder over equity distribution and breach of operating agreement.',
    opposing_party: 'David Chen',
    incident_date: '2026-06-15',
    urgency: 'urgent',
    preferred_contact: 'Phone',
    referral_source: 'Google Search',
    prior_attorney: false,
    prior_attorney_details: null,
    status: 'new',
    admin_notes: null,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '2',
    name: 'Priya Sharma',
    email: 'priya.sharma@gmail.com',
    phone: '(504) 555-0847',
    service_type: 'Employment Law',
    matter_description: 'Wrongful termination after reporting workplace safety violations. Terminated without cause after 6 years.',
    opposing_party: 'Coastal Industries LLC',
    incident_date: '2026-05-30',
    urgency: 'high',
    preferred_contact: 'Email',
    referral_source: 'Referral',
    prior_attorney: true,
    prior_attorney_details: 'Consulted briefly with another firm but did not retain.',
    status: 'reviewed',
    admin_notes: 'Strong case. Schedule consultation ASAP.',
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    name: 'Robert Tran',
    email: 'rtran@outlook.com',
    phone: null,
    service_type: 'Real Estate',
    matter_description: 'Dispute with contractor over incomplete renovation work. Paid $45,000, work is 60% complete.',
    opposing_party: 'Gulf Coast Renovations',
    incident_date: '2026-04-10',
    urgency: 'normal',
    preferred_contact: 'Email',
    referral_source: 'Website',
    prior_attorney: false,
    prior_attorney_details: null,
    status: 'scheduled',
    admin_notes: 'Consultation booked for next Tuesday.',
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function SubmissionCard({
  sub,
  onSelect,
  selected,
}: {
  sub: IntakeSubmission;
  onSelect: (s: IntakeSubmission) => void;
  selected: boolean;
}) {
  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return 'Just now';
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  return (
    <button
      onClick={() => onSelect(sub)}
      className={`w-full text-left p-4 rounded-xl border transition-all ${
        selected ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40 hover:bg-secondary/20'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-primary">{sub.name.charAt(0)}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{sub.name}</p>
            <p className="text-xs text-muted-foreground truncate">{sub.email}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLORS[sub.status]}`}>
            {sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
          </span>
          <span className="text-xs text-muted-foreground">{timeAgo(sub.created_at)}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {sub.service_type && (
          <span className="text-xs text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-full">{sub.service_type}</span>
        )}
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${URGENCY_COLORS[sub.urgency]}`}>
          {sub.urgency.charAt(0).toUpperCase() + sub.urgency.slice(1)}
        </span>
      </div>
    </button>
  );
}

// ── Intake Form (Public-facing preview) ──────────────────────────────────────

function IntakeFormPreview() {
  const [form, setForm] = useState({
    name: '', email: '', phone: '', service_type: '', matter_description: '',
    opposing_party: '', incident_date: '', urgency: 'normal', preferred_contact: 'Email',
    referral_source: '', prior_attorney: false, prior_attorney_details: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.matter_description) {
      toast.error('Please fill in all required fields');
      return;
    }
    setSubmitting(true);
    // Simulate submission
    await new Promise((r) => setTimeout(r, 1200));
    setSubmitted(true);
    setSubmitting(false);
    toast.success('Intake form submitted successfully');
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <h3 className="text-lg font-serif text-foreground mb-2">Intake Form Submitted</h3>
        <p className="text-sm text-muted-foreground max-w-sm">Thank you. Our team will review your submission and contact you within 1 business day.</p>
        <button onClick={() => setSubmitted(false)} className="mt-6 px-4 py-2 text-sm text-primary border border-primary/30 rounded-xl hover:bg-primary/5 transition-all">
          Submit Another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1.5">Full Name <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="John Smith"
            className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1.5">Email Address <span className="text-red-500">*</span></label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="john@email.com"
            className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1.5">Phone Number</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="(504) 555-0000"
            className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1.5">Type of Legal Matter</label>
          <select
            value={form.service_type}
            onChange={(e) => setForm({ ...form, service_type: e.target.value })}
            className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Select a practice area</option>
            {SERVICE_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-foreground mb-1.5">Describe Your Legal Matter <span className="text-red-500">*</span></label>
        <textarea
          value={form.matter_description}
          onChange={(e) => setForm({ ...form, matter_description: e.target.value })}
          placeholder="Please describe your situation in as much detail as possible..."
          rows={4}
          className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground resize-none"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1.5">Opposing Party (if applicable)</label>
          <input
            type="text"
            value={form.opposing_party}
            onChange={(e) => setForm({ ...form, opposing_party: e.target.value })}
            placeholder="Name or company"
            className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1.5">Date of Incident / Key Date</label>
          <input
            type="date"
            value={form.incident_date}
            onChange={(e) => setForm({ ...form, incident_date: e.target.value })}
            className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1.5">Urgency Level</label>
          <select
            value={form.urgency}
            onChange={(e) => setForm({ ...form, urgency: e.target.value })}
            className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="urgent">Urgent — Immediate attention needed</option>
            <option value="high">High — Within a few days</option>
            <option value="normal">Normal — Within a week</option>
            <option value="low">Low — No immediate deadline</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1.5">Preferred Contact Method</label>
          <select
            value={form.preferred_contact}
            onChange={(e) => setForm({ ...form, preferred_contact: e.target.value })}
            className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="Email">Email</option>
            <option value="Phone">Phone</option>
            <option value="Text">Text Message</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-foreground mb-1.5">How did you hear about us?</label>
        <select
          value={form.referral_source}
          onChange={(e) => setForm({ ...form, referral_source: e.target.value })}
          className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">Select a source</option>
          <option value="Google Search">Google Search</option>
          <option value="Referral">Referral from friend/family</option>
          <option value="Attorney Referral">Attorney Referral</option>
          <option value="Website">Website</option>
          <option value="Social Media">Social Media</option>
          <option value="Other">Other</option>
        </select>
      </div>

      <div className="flex items-start gap-3 p-4 bg-secondary/30 rounded-xl border border-border">
        <input
          type="checkbox"
          id="prior_attorney"
          checked={form.prior_attorney}
          onChange={(e) => setForm({ ...form, prior_attorney: e.target.checked })}
          className="mt-0.5 w-4 h-4 rounded border-border text-primary focus:ring-primary/30"
        />
        <label htmlFor="prior_attorney" className="text-sm text-foreground cursor-pointer">
          I have previously consulted with or retained another attorney for this matter
        </label>
      </div>

      {form.prior_attorney && (
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1.5">Prior Attorney Details</label>
          <textarea
            value={form.prior_attorney_details}
            onChange={(e) => setForm({ ...form, prior_attorney_details: e.target.value })}
            placeholder="Name of prior attorney/firm and reason for change..."
            rows={2}
            className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground resize-none"
          />
        </div>
      )}

      <div className="pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-all flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              Submitting…
            </>
          ) : 'Submit Intake Form'}
        </button>
        <p className="text-xs text-muted-foreground text-center mt-2">
          Your information is confidential and protected by attorney-client privilege.
        </p>
      </div>
    </form>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ClientIntakeFormsDashboard() {
  const [view, setView] = useState<'submissions' | 'form_preview'>('submissions');
  const [submissions, setSubmissions] = useState<IntakeSubmission[]>(MOCK_SUBMISSIONS);
  const [selected, setSelected] = useState<IntakeSubmission | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const filtered = statusFilter === 'all'
    ? submissions
    : submissions.filter((s) => s.status === statusFilter);

  const counts = {
    all: submissions.length,
    new: submissions.filter((s) => s.status === 'new').length,
    reviewed: submissions.filter((s) => s.status === 'reviewed').length,
    scheduled: submissions.filter((s) => s.status === 'scheduled').length,
    converted: submissions.filter((s) => s.status === 'converted').length,
    declined: submissions.filter((s) => s.status === 'declined').length,
  };

  const handleStatusUpdate = async (newStatus: IntakeSubmission['status']) => {
    if (!selected) return;
    setUpdatingStatus(true);
    await new Promise((r) => setTimeout(r, 500));
    setSubmissions((prev) => prev.map((s) => s.id === selected.id ? { ...s, status: newStatus, admin_notes: notes || s.admin_notes } : s));
    setSelected((prev) => prev ? { ...prev, status: newStatus } : null);
    setUpdatingStatus(false);
    setEditingNotes(false);
    toast.success('Status updated');
  };

  const handleSaveNotes = () => {
    if (!selected) return;
    setSubmissions((prev) => prev.map((s) => s.id === selected.id ? { ...s, admin_notes: notes } : s));
    setSelected((prev) => prev ? { ...prev, admin_notes: notes } : null);
    setEditingNotes(false);
    toast.success('Notes saved');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-serif text-foreground">Client Intake Forms</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage intake submissions, review new inquiries, and track conversion status.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setView('submissions')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${view === 'submissions' ? 'bg-primary text-white' : 'bg-secondary/50 text-muted-foreground hover:text-foreground'}`}
          >
            Submissions
          </button>
          <button
            onClick={() => setView('form_preview')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${view === 'form_preview' ? 'bg-primary text-white' : 'bg-secondary/50 text-muted-foreground hover:text-foreground'}`}
          >
            Form Preview
          </button>
        </div>
      </div>

      {view === 'form_preview' && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="mb-6">
            <h3 className="text-base font-semibold text-foreground">Client Intake Form</h3>
            <p className="text-xs text-muted-foreground mt-0.5">This is the form clients fill out. Share the link at <code className="bg-secondary/50 px-1 rounded text-xs">/intake</code></p>
          </div>
          <IntakeFormPreview />
        </div>
      )}

      {view === 'submissions' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {Object.entries(counts).map(([key, val]) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`p-3 rounded-xl border text-center transition-all ${statusFilter === key ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40'}`}
              >
                <p className="text-lg font-bold text-foreground">{val}</p>
                <p className="text-xs text-muted-foreground capitalize">{key}</p>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* List */}
            <div className="lg:col-span-2 space-y-3">
              {filtered.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-border rounded-xl">
                  <p className="text-sm text-muted-foreground">No submissions found</p>
                </div>
              ) : (
                filtered.map((s) => (
                  <SubmissionCard
                    key={s.id}
                    sub={s}
                    onSelect={(sub) => { setSelected(sub); setNotes(sub.admin_notes ?? ''); setEditingNotes(false); }}
                    selected={selected?.id === s.id}
                  />
                ))
              )}
            </div>

            {/* Detail */}
            <div className="lg:col-span-3">
              {!selected ? (
                <div className="h-full min-h-64 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-border rounded-xl">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground mb-3">
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
                  </svg>
                  <p className="text-sm text-muted-foreground">Select a submission to view details</p>
                </div>
              ) : (
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-border bg-secondary/30 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{selected.name}</h3>
                      <p className="text-xs text-muted-foreground">{selected.email}{selected.phone ? ` · ${selected.phone}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${URGENCY_COLORS[selected.urgency]}`}>
                        {selected.urgency.charAt(0).toUpperCase() + selected.urgency.slice(1)}
                      </span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLORS[selected.status]}`}>
                        {selected.status.charAt(0).toUpperCase() + selected.status.slice(1)}
                      </span>
                    </div>
                  </div>

                  <div className="p-5 space-y-4">
                    {/* Matter Details */}
                    <div className="grid grid-cols-2 gap-3">
                      {selected.service_type && (
                        <div className="bg-secondary/30 rounded-xl p-3">
                          <p className="text-xs text-muted-foreground mb-0.5">Practice Area</p>
                          <p className="text-sm font-semibold text-foreground">{selected.service_type}</p>
                        </div>
                      )}
                      {selected.incident_date && (
                        <div className="bg-secondary/30 rounded-xl p-3">
                          <p className="text-xs text-muted-foreground mb-0.5">Key Date</p>
                          <p className="text-sm font-semibold text-foreground">{new Date(selected.incident_date).toLocaleDateString()}</p>
                        </div>
                      )}
                      {selected.preferred_contact && (
                        <div className="bg-secondary/30 rounded-xl p-3">
                          <p className="text-xs text-muted-foreground mb-0.5">Preferred Contact</p>
                          <p className="text-sm font-semibold text-foreground">{selected.preferred_contact}</p>
                        </div>
                      )}
                      {selected.referral_source && (
                        <div className="bg-secondary/30 rounded-xl p-3">
                          <p className="text-xs text-muted-foreground mb-0.5">Referral Source</p>
                          <p className="text-sm font-semibold text-foreground">{selected.referral_source}</p>
                        </div>
                      )}
                    </div>

                    {selected.matter_description && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Matter Description</p>
                        <p className="text-sm text-foreground leading-relaxed bg-secondary/20 rounded-xl p-3">{selected.matter_description}</p>
                      </div>
                    )}

                    {selected.opposing_party && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Opposing Party</p>
                        <p className="text-sm text-foreground">{selected.opposing_party}</p>
                      </div>
                    )}

                    {selected.prior_attorney && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                        <p className="text-xs font-semibold text-amber-700 mb-0.5">Prior Attorney</p>
                        <p className="text-xs text-amber-700">{selected.prior_attorney_details || 'Yes — no details provided'}</p>
                      </div>
                    )}

                    {/* Admin Notes */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Admin Notes</p>
                        <button onClick={() => setEditingNotes(!editingNotes)} className="text-xs text-primary hover:underline">
                          {editingNotes ? 'Cancel' : 'Edit'}
                        </button>
                      </div>
                      {editingNotes ? (
                        <div>
                          <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                            placeholder="Add internal notes..."
                            className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                          />
                          <button onClick={handleSaveNotes} className="mt-2 px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary/90 transition-all">
                            Save Notes
                          </button>
                        </div>
                      ) : (
                        <p className="text-sm text-foreground bg-secondary/20 rounded-xl p-3 min-h-[48px]">
                          {selected.admin_notes || <span className="text-muted-foreground italic">No notes yet</span>}
                        </p>
                      )}
                    </div>

                    {/* Status Actions */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Update Status</p>
                      <div className="flex flex-wrap gap-2">
                        {(['new', 'reviewed', 'scheduled', 'converted', 'declined'] as const).map((s) => (
                          <button
                            key={s}
                            onClick={() => handleStatusUpdate(s)}
                            disabled={updatingStatus || selected.status === s}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all disabled:opacity-50 ${
                              selected.status === s
                                ? STATUS_COLORS[s]
                                : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                            }`}
                          >
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
