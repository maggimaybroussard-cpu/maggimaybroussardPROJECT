'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CaseRecord {
  id: string;
  name: string;
  firm: string;
  email: string;
  service: string;
  status: string;
  booking_stage: string | null;
  notes: string | null;
  message: string | null;
  created_at: string;
  updated_at: string;
}

interface Engagement {
  id: string;
  inquiry_id: string;
  title: string;
  matter_number: string | null;
  engagement_type: string;
  retainer_tier: string;
  status: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  hourly_rate: number | null;
  flat_fee: number | null;
  retainer_amount: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface CaseContact {
  id: string;
  inquiry_id: string;
  contact_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  contact_role: string;
  notes: string | null;
  created_at: string;
}

interface CaseDocument {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  category: string | null;
  document_type: string | null;
  uploaded_by: string;
  requires_client_review: boolean;
  created_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RETAINER_TIERS = [
  { value: 'none', label: 'No Retainer', color: 'bg-gray-100 text-gray-600 border-gray-200' },
  { value: 'starter', label: 'Starter', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'professional', label: 'Professional', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { value: 'enterprise', label: 'Enterprise', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'custom', label: 'Custom', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
];

const ENGAGEMENT_TYPES = [
  'general', 'litigation', 'contract', 'corporate', 'employment',
  'real_estate', 'ip', 'immigration', 'family', 'criminal', 'other',
];

const ENGAGEMENT_TYPE_LABELS: Record<string, string> = {
  general: 'General', litigation: 'Litigation', contract: 'Contract',
  corporate: 'Corporate', employment: 'Employment', real_estate: 'Real Estate',
  ip: 'Intellectual Property', immigration: 'Immigration', family: 'Family',
  criminal: 'Criminal', other: 'Other',
};

const ENGAGEMENT_STATUSES = ['active', 'pending', 'on_hold', 'closed', 'archived'];
const ENGAGEMENT_STATUS_LABELS: Record<string, string> = {
  active: 'Active', pending: 'Pending', on_hold: 'On Hold', closed: 'Closed', archived: 'Archived',
};
const ENGAGEMENT_STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  on_hold: 'bg-orange-50 text-orange-700 border-orange-200',
  closed: 'bg-gray-100 text-gray-600 border-gray-200',
  archived: 'bg-gray-50 text-gray-500 border-gray-200',
};

const CONTACT_ROLES = [
  'primary', 'co_counsel', 'opposing_party', 'witness', 'expert', 'paralegal', 'other',
];
const CONTACT_ROLE_LABELS: Record<string, string> = {
  primary: 'Primary Contact', co_counsel: 'Co-Counsel', opposing_party: 'Opposing Party',
  witness: 'Witness', expert: 'Expert Witness', paralegal: 'Paralegal', other: 'Other',
};

const BOOKING_STAGE_LABELS: Record<string, string> = {
  inquiry: 'Inquiry', consultation_booked: 'Consultation Booked',
  proposal_sent: 'Proposal Sent', active_client: 'Active Client',
  completed: 'Completed', closed: 'Closed',
};

const BOOKING_STAGE_COLORS: Record<string, string> = {
  inquiry: 'bg-blue-50 text-blue-700 border-blue-200',
  consultation_booked: 'bg-purple-50 text-purple-700 border-purple-200',
  proposal_sent: 'bg-amber-50 text-amber-700 border-amber-200',
  active_client: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
  closed: 'bg-gray-100 text-gray-500 border-gray-200',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RetainerTierBadge({ tier }: { tier: string }) {
  const t = RETAINER_TIERS.find((r) => r.value === tier) ?? RETAINER_TIERS[0];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${t.color}`}>
      {t.label}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type ActiveView = 'list' | 'detail';
type DetailTab = 'overview' | 'engagements' | 'contacts' | 'documents';

export default function CaseManagementDashboard() {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [view, setView] = useState<ActiveView>('list');
  const [selectedCase, setSelectedCase] = useState<CaseRecord | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('overview');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Engagements
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [engLoading, setEngLoading] = useState(false);
  const [showEngForm, setShowEngForm] = useState(false);
  const [engForm, setEngForm] = useState({
    title: '', matter_number: '', engagement_type: 'general', retainer_tier: 'none',
    status: 'active', description: '', start_date: '', end_date: '',
    hourly_rate: '', flat_fee: '', retainer_amount: '', notes: '',
  });
  const [savingEng, setSavingEng] = useState(false);
  const [editingEngId, setEditingEngId] = useState<string | null>(null);

  // Contacts
  const [contacts, setContacts] = useState<CaseContact[]>([]);
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactForm, setContactForm] = useState({
    contact_name: '', contact_email: '', contact_phone: '', contact_role: 'primary', notes: '',
  });
  const [savingContact, setSavingContact] = useState(false);

  // Documents
  const [documents, setDocuments] = useState<CaseDocument[]>([]);
  const [docLoading, setDocLoading] = useState(false);

  // Create case modal
  const [showCreateCase, setShowCreateCase] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '', firm: '', email: '', service: '', message: '', booking_stage: 'inquiry',
  });
  const [creatingCase, setCreatingCase] = useState(false);

  const showToast = useCallback((msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // ── Fetch cases ──
  const fetchCases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: err } = await supabase
        .from('contact_inquiries')
        .select('id,name,firm,email,service,status,booking_stage,notes,message,created_at,updated_at')
        .order('updated_at', { ascending: false });
      if (err) throw err;
      setCases(data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load cases.');
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch case details ──
  const fetchCaseDetails = useCallback(async (caseId: string) => {
    setEngLoading(true);
    setDocLoading(true);
    try {
      const supabase = createClient();
      const [engRes, contactsRes, docsRes] = await Promise.all([
        supabase.from('engagements').select('*').eq('inquiry_id', caseId).order('created_at', { ascending: false }),
        supabase.from('case_contacts').select('*').eq('inquiry_id', caseId).order('created_at', { ascending: false }),
        supabase.from('case_documents').select('id,file_name,file_url,file_type,file_size,category,document_type,uploaded_by,requires_client_review,created_at').eq('inquiry_id', caseId).order('created_at', { ascending: false }),
      ]);
      setEngagements(engRes.data || []);
      setContacts(contactsRes.data || []);
      setDocuments(docsRes.data || []);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to load case details.', 'error');
    } finally {
      setEngLoading(false);
      setDocLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchCases(); }, [fetchCases]);

  const handleSelectCase = useCallback((c: CaseRecord) => {
    setSelectedCase(c);
    setView('detail');
    setDetailTab('overview');
    setShowEngForm(false);
    setShowContactForm(false);
    setEditingEngId(null);
    fetchCaseDetails(c.id);
  }, [fetchCaseDetails]);

  // ── Create case ──
  const handleCreateCase = async () => {
    if (!createForm.name || !createForm.email || !createForm.service) {
      showToast('Name, email, and service are required.', 'error');
      return;
    }
    setCreatingCase(true);
    try {
      const supabase = createClient();
      const { data, error: err } = await supabase
        .from('contact_inquiries')
        .insert({
          name: createForm.name.trim(),
          firm: createForm.firm.trim() || '',
          email: createForm.email.trim(),
          service: createForm.service.trim(),
          message: createForm.message.trim() || 'Case created via admin interface.',
          status: 'new',
          booking_stage: createForm.booking_stage,
        })
        .select()
        .single();
      if (err) throw err;
      setCases((prev) => [data, ...prev]);
      setShowCreateCase(false);
      setCreateForm({ name: '', firm: '', email: '', service: '', message: '', booking_stage: 'inquiry' });
      showToast('Case created successfully.', 'success');
      handleSelectCase(data);

      // ── Trigger background legal research via Lexi ──
      fetch('/api/lexi/auto-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matter_name: data.name,
          service: data.service,
          matter_ref: data.id,
          jurisdiction: 'Louisiana',
        }),
      }).then((res) => {
        if (res.ok) {
          showToast('Lexi is researching this matter in the background…', 'success');
        }
      }).catch(() => {
        // silently fail — research is non-blocking
      });
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to create case.', 'error');
    } finally {
      setCreatingCase(false);
    }
  };

  // ── Update case stage ──
  const handleStageUpdate = async (stage: string) => {
    if (!selectedCase) return;
    try {
      const supabase = createClient();
      const { error: err } = await supabase
        .from('contact_inquiries')
        .update({ booking_stage: stage, updated_at: new Date().toISOString() })
        .eq('id', selectedCase.id);
      if (err) throw err;

      // ── Auto-send lifecycle email on stage change ──
      if (selectedCase.email) {
        try {
          await fetch('/api/case-lifecycle/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              eventType: 'case_stage_changed',
              clientEmail: selectedCase.email,
              clientName: selectedCase.name,
              inquiryId: selectedCase.id,
              details: {
                caseName: selectedCase.name,
                caseId: selectedCase.id,
                service: selectedCase.service,
                previousStage: selectedCase.booking_stage ?? 'inquiry',
                newStage: stage,
                message: null,
              },
            }),
          });
        } catch (emailErr) {
          console.warn('[CaseManagement] Failed to send stage change email:', emailErr);
        }
      }

      const updated = { ...selectedCase, booking_stage: stage };
      setSelectedCase(updated);
      setCases((prev) => prev.map((c) => c.id === selectedCase.id ? updated : c));
      showToast('Stage updated.', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to update stage.', 'error');
    }
  };

  // ── Engagement CRUD ──
  const resetEngForm = () => setEngForm({
    title: '', matter_number: '', engagement_type: 'general', retainer_tier: 'none',
    status: 'active', description: '', start_date: '', end_date: '',
    hourly_rate: '', flat_fee: '', retainer_amount: '', notes: '',
  });

  const handleSaveEngagement = async () => {
    if (!selectedCase || !engForm.title.trim()) {
      showToast('Engagement title is required.', 'error');
      return;
    }
    setSavingEng(true);
    try {
      const supabase = createClient();
      const payload = {
        inquiry_id: selectedCase.id,
        title: engForm.title.trim(),
        matter_number: engForm.matter_number.trim() || null,
        engagement_type: engForm.engagement_type,
        retainer_tier: engForm.retainer_tier,
        status: engForm.status,
        description: engForm.description.trim() || null,
        start_date: engForm.start_date || null,
        end_date: engForm.end_date || null,
        hourly_rate: engForm.hourly_rate ? parseFloat(engForm.hourly_rate) : null,
        flat_fee: engForm.flat_fee ? parseFloat(engForm.flat_fee) : null,
        retainer_amount: engForm.retainer_amount ? parseFloat(engForm.retainer_amount) : null,
        notes: engForm.notes.trim() || null,
      };

      if (editingEngId) {
        const { data, error: err } = await supabase
          .from('engagements').update(payload).eq('id', editingEngId).select().single();
        if (err) throw err;
        setEngagements((prev) => prev.map((e) => e.id === editingEngId ? data : e));
        showToast('Engagement updated.', 'success');
      } else {
        const { data, error: err } = await supabase
          .from('engagements').insert(payload).select().single();
        if (err) throw err;
        setEngagements((prev) => [data, ...prev]);
        showToast('Engagement created.', 'success');
      }
      setShowEngForm(false);
      setEditingEngId(null);
      resetEngForm();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to save engagement.', 'error');
    } finally {
      setSavingEng(false);
    }
  };

  const handleEditEngagement = (eng: Engagement) => {
    setEngForm({
      title: eng.title,
      matter_number: eng.matter_number ?? '',
      engagement_type: eng.engagement_type,
      retainer_tier: eng.retainer_tier,
      status: eng.status,
      description: eng.description ?? '',
      start_date: eng.start_date ?? '',
      end_date: eng.end_date ?? '',
      hourly_rate: eng.hourly_rate?.toString() ?? '',
      flat_fee: eng.flat_fee?.toString() ?? '',
      retainer_amount: eng.retainer_amount?.toString() ?? '',
      notes: eng.notes ?? '',
    });
    setEditingEngId(eng.id);
    setShowEngForm(true);
  };

  const handleDeleteEngagement = async (engId: string) => {
    if (!confirm('Delete this engagement?')) return;
    try {
      const supabase = createClient();
      const { error: err } = await supabase.from('engagements').delete().eq('id', engId);
      if (err) throw err;
      setEngagements((prev) => prev.filter((e) => e.id !== engId));
      showToast('Engagement deleted.', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to delete.', 'error');
    }
  };

  // ── Contact CRUD ──
  const handleSaveContact = async () => {
    if (!selectedCase || !contactForm.contact_name.trim()) {
      showToast('Contact name is required.', 'error');
      return;
    }
    setSavingContact(true);
    try {
      const supabase = createClient();
      const { data, error: err } = await supabase
        .from('case_contacts')
        .insert({
          inquiry_id: selectedCase.id,
          contact_name: contactForm.contact_name.trim(),
          contact_email: contactForm.contact_email.trim() || null,
          contact_phone: contactForm.contact_phone.trim() || null,
          contact_role: contactForm.contact_role,
          notes: contactForm.notes.trim() || null,
        })
        .select()
        .single();
      if (err) throw err;
      setContacts((prev) => [data, ...prev]);
      setContactForm({ contact_name: '', contact_email: '', contact_phone: '', contact_role: 'primary', notes: '' });
      setShowContactForm(false);
      showToast('Contact linked.', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to link contact.', 'error');
    } finally {
      setSavingContact(false);
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!confirm('Remove this contact?')) return;
    try {
      const supabase = createClient();
      const { error: err } = await supabase.from('case_contacts').delete().eq('id', contactId);
      if (err) throw err;
      setContacts((prev) => prev.filter((c) => c.id !== contactId));
      showToast('Contact removed.', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to remove contact.', 'error');
    }
  };

  // ── Filtered list ──
  const filtered = cases.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.firm ?? '').toLowerCase().includes(q) ||
      c.service.toLowerCase().includes(q);
    const matchStage = stageFilter === 'all' || c.booking_stage === stageFilter;
    return matchSearch && matchStage;
  });

  const stageCounts = Object.keys(BOOKING_STAGE_LABELS).reduce<Record<string, number>>((acc, s) => {
    acc[s] = cases.filter((c) => c.booking_stage === s).length;
    return acc;
  }, {});

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 max-w-sm px-5 py-4 rounded-2xl shadow-xl border backdrop-blur-sm flex items-center gap-3 ${
          toast.type === 'success' ? 'bg-card border-accent/30 text-foreground' : 'bg-card border-red-400/30 text-foreground'
        }`}>
          <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
            toast.type === 'success' ? 'bg-accent/15 text-accent' : 'bg-red-400/15 text-red-400'
          }`}>
            {toast.type === 'success' ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            )}
          </div>
          <p className="text-sm">{toast.msg}</p>
        </div>
      )}

      {/* ── Create Case Modal ── */}
      {showCreateCase && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="px-6 py-5 border-b border-border flex items-center justify-between">
              <h2 className="font-serif text-xl text-foreground">Create New Case</h2>
              <button onClick={() => setShowCreateCase(false)} className="text-muted-foreground/50 hover:text-foreground transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block font-medium">Client Name *</label>
                  <input type="text" placeholder="Jane Smith" value={createForm.name}
                    onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block font-medium">Firm / Company</label>
                  <input type="text" placeholder="Acme Corp" value={createForm.firm}
                    onChange={(e) => setCreateForm((f) => ({ ...f, firm: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block font-medium">Email *</label>
                <input type="email" placeholder="jane@example.com" value={createForm.email}
                  onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block font-medium">Service Type *</label>
                  <input type="text" placeholder="Contract Review" value={createForm.service}
                    onChange={(e) => setCreateForm((f) => ({ ...f, service: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block font-medium">Initial Stage</label>
                  <select value={createForm.booking_stage}
                    onChange={(e) => setCreateForm((f) => ({ ...f, booking_stage: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all">
                    {Object.entries(BOOKING_STAGE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block font-medium">Initial Notes</label>
                <textarea rows={3} placeholder="Brief description of the matter…" value={createForm.message}
                  onChange={(e) => setCreateForm((f) => ({ ...f, message: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all resize-none" />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowCreateCase(false)}
                  className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all">
                  Cancel
                </button>
                <button onClick={handleCreateCase} disabled={creatingCase}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{ background: '#355E3B', color: '#fff' }}>
                  {creatingCase ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  ) : null}
                  {creatingCase ? 'Creating…' : 'Create Case'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── List View ── */}
      {view === 'list' && (
        <>
          {/* Header row */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 relative">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input type="text" placeholder="Search by name, email, firm, or service…" value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all" />
            </div>
            <button onClick={() => setShowCreateCase(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 whitespace-nowrap"
              style={{ background: '#355E3B', color: '#fff' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New Case
            </button>
          </div>

          {/* Stage filter pills */}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setStageFilter('all')}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest border transition-all ${
                stageFilter === 'all' ? 'bg-primary text-white border-primary' : 'bg-card text-muted-foreground border-border hover:border-primary/40'
              }`}>
              All ({cases.length})
            </button>
            {Object.entries(BOOKING_STAGE_LABELS).map(([key, label]) => (
              <button key={key} onClick={() => setStageFilter(stageFilter === key ? 'all' : key)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest border transition-all ${
                  stageFilter === key ? 'bg-primary text-white border-primary' : 'bg-card text-muted-foreground border-border hover:border-primary/40'
                }`}>
                {label} ({stageCounts[key] ?? 0})
              </button>
            ))}
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
          )}

          {/* Cases table */}
          {loading ? (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="border-b border-border last:border-0 px-5 py-4 flex items-center gap-4">
                  <div className="flex-1 space-y-1.5">
                    <div className="w-36 h-4 bg-muted/60 rounded animate-pulse" />
                    <div className="w-24 h-3 bg-muted/40 rounded animate-pulse" />
                  </div>
                  <div className="w-24 h-6 bg-muted/50 rounded-full animate-pulse" />
                  <div className="w-20 h-4 bg-muted/40 rounded animate-pulse hidden md:block" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-secondary/60 flex items-center justify-center mx-auto mb-4">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/50">
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                </svg>
              </div>
              <p className="text-muted-foreground text-sm font-medium">No cases found</p>
              <p className="text-muted-foreground/60 text-xs mt-1">Create a new case or adjust your filters</p>
              <button onClick={() => setShowCreateCase(true)}
                className="mt-4 px-5 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
                style={{ background: '#355E3B', color: '#fff' }}>
                Create First Case
              </button>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/40">
                      <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Client</th>
                      <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden sm:table-cell">Service</th>
                      <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden md:table-cell">Stage</th>
                      <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden lg:table-cell">Updated</th>
                      <th className="text-right px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c, i) => (
                      <tr key={c.id}
                        className={`border-b border-border last:border-0 transition-colors ${
                          i % 2 === 0 ? 'hover:bg-secondary/20' : 'bg-secondary/10 hover:bg-secondary/30'
                        }`}>
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-foreground">{c.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{c.email}</p>
                          {c.firm && <p className="text-xs text-muted-foreground/60 mt-0.5">{c.firm}</p>}
                        </td>
                        <td className="px-5 py-3.5 hidden sm:table-cell">
                          <span className="text-sm text-foreground/80">{c.service}</span>
                        </td>
                        <td className="px-5 py-3.5 hidden md:table-cell">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${BOOKING_STAGE_COLORS[c.booking_stage ?? ''] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                            {BOOKING_STAGE_LABELS[c.booking_stage ?? ''] ?? c.booking_stage ?? '—'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 hidden lg:table-cell text-xs text-muted-foreground">
                          {formatDate(c.updated_at)}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => handleSelectCase(c)}
                              className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all">
                              Manage
                            </button>
                            <Link href={`/admin/cases/${c.id}`}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90"
                              style={{ background: '#355E3B', color: '#fff' }}>
                              Full View
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 border-t border-border bg-secondary/20 text-xs text-muted-foreground">
                {filtered.length} of {cases.length} cases · {cases.filter((c) => c.booking_stage === 'active_client').length} active
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Detail View ── */}
      {view === 'detail' && selectedCase && (
        <div className="space-y-5">
          {/* Back + header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <button onClick={() => { setView('list'); setSelectedCase(null); }}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                All Cases
              </button>
              <span className="text-muted-foreground/30">/</span>
              <span className="text-sm font-medium text-foreground">{selectedCase.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${BOOKING_STAGE_COLORS[selectedCase.booking_stage ?? ''] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                {BOOKING_STAGE_LABELS[selectedCase.booking_stage ?? ''] ?? selectedCase.booking_stage ?? '—'}
              </span>
              <Link href={`/admin/cases/${selectedCase.id}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90"
                style={{ background: '#355E3B', color: '#fff' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                Full Case View
              </Link>
            </div>
          </div>

          {/* Case header card */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="font-serif text-2xl text-foreground">{selectedCase.name}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {selectedCase.firm && <>{selectedCase.firm} · </>}
                  <a href={`mailto:${selectedCase.email}`} className="text-accent hover:underline">{selectedCase.email}</a>
                </p>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <p>Created {formatDate(selectedCase.created_at)}</p>
                <p className="mt-0.5">Updated {formatDate(selectedCase.updated_at)}</p>
              </div>
            </div>

            {/* Stage selector */}
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Case Stage</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(BOOKING_STAGE_LABELS).map(([key, label]) => (
                  <button key={key} onClick={() => handleStageUpdate(key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                      selectedCase.booking_stage === key
                        ? BOOKING_STAGE_COLORS[key]
                        : 'bg-transparent border-border text-muted-foreground hover:border-accent/50'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Detail tabs */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="flex border-b border-border bg-secondary/20 overflow-x-auto">
              {(['overview', 'engagements', 'contacts', 'documents'] as DetailTab[]).map((tab) => (
                <button key={tab} onClick={() => setDetailTab(tab)}
                  className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold uppercase tracking-widest whitespace-nowrap transition-all ${
                    detailTab === tab
                      ? 'text-foreground border-b-2 border-primary bg-card'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}>
                  {tab === 'overview' && (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  )}
                  {tab === 'engagements' && (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                  )}
                  {tab === 'contacts' && (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  )}
                  {tab === 'documents' && (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  )}
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  {tab === 'engagements' && engagements.length > 0 && (
                    <span className="ml-1 w-4 h-4 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">{engagements.length}</span>
                  )}
                  {tab === 'contacts' && contacts.length > 0 && (
                    <span className="ml-1 w-4 h-4 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">{contacts.length}</span>
                  )}
                  {tab === 'documents' && documents.length > 0 && (
                    <span className="ml-1 w-4 h-4 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">{documents.length}</span>
                  )}
                </button>
              ))}
            </div>

            <div className="p-6">
              {/* ── Overview Tab ── */}
              {detailTab === 'overview' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="md:col-span-2 space-y-5">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Service</p>
                      <p className="text-sm text-foreground">{selectedCase.service}</p>
                    </div>
                    {selectedCase.notes && (
                      <div>
                        <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Notes</p>
                        <p className="text-sm text-foreground/80 leading-relaxed bg-secondary/40 rounded-xl p-4 border border-border whitespace-pre-wrap">{selectedCase.notes}</p>
                      </div>
                    )}
                    {selectedCase.message && (
                      <div>
                        <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2 flex items-center gap-1.5">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                          Initial Inquiry
                        </p>
                        <p className="text-sm text-foreground/80 leading-relaxed bg-amber-50/60 rounded-xl p-4 border border-amber-200/60 whitespace-pre-wrap">{selectedCase.message}</p>
                      </div>
                    )}
                    <div className="flex gap-3 pt-2">
                      <a href={`mailto:${selectedCase.email}?subject=Re: Your Case — Maggi May Broussard`}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
                        style={{ background: '#355E3B', color: '#fff' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                        Email Client
                      </a>
                      <button onClick={() => { setDetailTab('engagements'); setShowEngForm(true); }}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Add Engagement
                      </button>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="bg-secondary/30 rounded-xl p-4 border border-border">
                      <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">Summary</p>
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Engagements</span>
                          <span className="text-sm font-semibold text-foreground">{engagements.length}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Contacts</span>
                          <span className="text-sm font-semibold text-foreground">{contacts.length}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Documents</span>
                          <span className="text-sm font-semibold text-foreground">{documents.length}</span>
                        </div>
                        {engagements.length > 0 && (
                          <div className="flex items-center justify-between pt-1 border-t border-border">
                            <span className="text-xs text-muted-foreground">Retainer Tier</span>
                            <RetainerTierBadge tier={engagements[0]?.retainer_tier ?? 'none'} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Engagements Tab ── */}
              {detailTab === 'engagements' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-foreground">{engagements.length} Engagement{engagements.length !== 1 ? 's' : ''}</h3>
                    <button onClick={() => { resetEngForm(); setEditingEngId(null); setShowEngForm(!showEngForm); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      {showEngForm && !editingEngId ? 'Cancel' : 'New Engagement'}
                    </button>
                  </div>

                  {/* Engagement form */}
                  {showEngForm && (
                    <div className="p-5 rounded-xl border border-accent/30 bg-accent/5 space-y-4">
                      <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
                        {editingEngId ? 'Edit Engagement' : 'New Engagement'}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                          <label className="text-xs text-muted-foreground mb-1 block font-medium">Title *</label>
                          <input type="text" placeholder="e.g. Contract Review — Q3 Vendor Agreement" value={engForm.title}
                            onChange={(e) => setEngForm((f) => ({ ...f, title: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all" />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block font-medium">Matter Number</label>
                          <input type="text" placeholder="2024-001" value={engForm.matter_number}
                            onChange={(e) => setEngForm((f) => ({ ...f, matter_number: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all" />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block font-medium">Engagement Type</label>
                          <select value={engForm.engagement_type}
                            onChange={(e) => setEngForm((f) => ({ ...f, engagement_type: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all">
                            {ENGAGEMENT_TYPES.map((t) => (
                              <option key={t} value={t}>{ENGAGEMENT_TYPE_LABELS[t]}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block font-medium">Retainer Tier</label>
                          <select value={engForm.retainer_tier}
                            onChange={(e) => setEngForm((f) => ({ ...f, retainer_tier: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all">
                            {RETAINER_TIERS.map((t) => (
                              <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block font-medium">Status</label>
                          <select value={engForm.status}
                            onChange={(e) => setEngForm((f) => ({ ...f, status: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all">
                            {ENGAGEMENT_STATUSES.map((s) => (
                              <option key={s} value={s}>{ENGAGEMENT_STATUS_LABELS[s]}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block font-medium">Start Date</label>
                          <input type="date" value={engForm.start_date}
                            onChange={(e) => setEngForm((f) => ({ ...f, start_date: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all" />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block font-medium">End Date</label>
                          <input type="date" value={engForm.end_date}
                            onChange={(e) => setEngForm((f) => ({ ...f, end_date: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all" />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block font-medium">Hourly Rate ($)</label>
                          <input type="number" placeholder="350.00" value={engForm.hourly_rate}
                            onChange={(e) => setEngForm((f) => ({ ...f, hourly_rate: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all" />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block font-medium">Flat Fee ($)</label>
                          <input type="number" placeholder="5000.00" value={engForm.flat_fee}
                            onChange={(e) => setEngForm((f) => ({ ...f, flat_fee: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all" />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block font-medium">Retainer Amount ($)</label>
                          <input type="number" placeholder="2500.00" value={engForm.retainer_amount}
                            onChange={(e) => setEngForm((f) => ({ ...f, retainer_amount: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all" />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-xs text-muted-foreground mb-1 block font-medium">Description</label>
                          <textarea rows={2} placeholder="Scope of work, key deliverables…" value={engForm.description}
                            onChange={(e) => setEngForm((f) => ({ ...f, description: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all resize-none" />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-xs text-muted-foreground mb-1 block font-medium">Notes</label>
                          <textarea rows={2} placeholder="Internal notes, special terms…" value={engForm.notes}
                            onChange={(e) => setEngForm((f) => ({ ...f, notes: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all resize-none" />
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button onClick={() => { setShowEngForm(false); setEditingEngId(null); resetEngForm(); }}
                          className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:text-foreground transition-all">
                          Cancel
                        </button>
                        <button onClick={handleSaveEngagement} disabled={savingEng}
                          className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
                          style={{ background: '#355E3B', color: '#fff' }}>
                          {savingEng ? (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                          ) : null}
                          {savingEng ? 'Saving…' : editingEngId ? 'Update Engagement' : 'Create Engagement'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Engagement list */}
                  {engLoading ? (
                    <div className="space-y-3">
                      {[1, 2].map((i) => <div key={i} className="h-24 bg-muted/30 rounded-xl animate-pulse" />)}
                    </div>
                  ) : engagements.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground text-sm">
                      No engagements yet. Create one to organize this client&apos;s work.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {engagements.map((eng) => (
                        <div key={eng.id} className="p-5 rounded-xl border border-border bg-secondary/20 hover:bg-secondary/30 transition-colors">
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <h4 className="font-semibold text-foreground text-sm">{eng.title}</h4>
                                {eng.matter_number && (
                                  <span className="text-xs text-muted-foreground font-mono bg-secondary/60 px-2 py-0.5 rounded">#{eng.matter_number}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${ENGAGEMENT_STATUS_COLORS[eng.status]}`}>
                                  {ENGAGEMENT_STATUS_LABELS[eng.status]}
                                </span>
                                <RetainerTierBadge tier={eng.retainer_tier} />
                                <span className="text-xs text-muted-foreground">{ENGAGEMENT_TYPE_LABELS[eng.engagement_type]}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <button onClick={() => handleEditEngagement(eng)}
                                className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              </button>
                              <button onClick={() => handleDeleteEngagement(eng.id)}
                                className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-red-500 hover:border-red-300 transition-all">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                              </button>
                            </div>
                          </div>
                          {eng.description && (
                            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{eng.description}</p>
                          )}
                          <div className="grid grid-cols-3 gap-3">
                            {eng.hourly_rate && (
                              <div className="bg-card rounded-lg p-2.5 border border-border text-center">
                                <p className="text-xs text-muted-foreground">Hourly</p>
                                <p className="text-sm font-semibold text-foreground mt-0.5">{formatCurrency(eng.hourly_rate)}/hr</p>
                              </div>
                            )}
                            {eng.flat_fee && (
                              <div className="bg-card rounded-lg p-2.5 border border-border text-center">
                                <p className="text-xs text-muted-foreground">Flat Fee</p>
                                <p className="text-sm font-semibold text-foreground mt-0.5">{formatCurrency(eng.flat_fee)}</p>
                              </div>
                            )}
                            {eng.retainer_amount && (
                              <div className="bg-card rounded-lg p-2.5 border border-border text-center">
                                <p className="text-xs text-muted-foreground">Retainer</p>
                                <p className="text-sm font-semibold text-foreground mt-0.5">{formatCurrency(eng.retainer_amount)}</p>
                              </div>
                            )}
                          </div>
                          {(eng.start_date || eng.end_date) && (
                            <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                              {eng.start_date && <span>Start: {formatDate(eng.start_date)}</span>}
                              {eng.end_date && <span>End: {formatDate(eng.end_date)}</span>}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Contacts Tab ── */}
              {detailTab === 'contacts' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-foreground">{contacts.length} Linked Contact{contacts.length !== 1 ? 's' : ''}</h3>
                    <button onClick={() => setShowContactForm(!showContactForm)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      {showContactForm ? 'Cancel' : 'Link Contact'}
                    </button>
                  </div>

                  {showContactForm && (
                    <div className="p-5 rounded-xl border border-accent/30 bg-accent/5 space-y-4">
                      <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Link Contact</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block font-medium">Name *</label>
                          <input type="text" placeholder="John Doe" value={contactForm.contact_name}
                            onChange={(e) => setContactForm((f) => ({ ...f, contact_name: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all" />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block font-medium">Role</label>
                          <select value={contactForm.contact_role}
                            onChange={(e) => setContactForm((f) => ({ ...f, contact_role: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all">
                            {CONTACT_ROLES.map((r) => (
                              <option key={r} value={r}>{CONTACT_ROLE_LABELS[r]}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block font-medium">Email</label>
                          <input type="email" placeholder="john@example.com" value={contactForm.contact_email}
                            onChange={(e) => setContactForm((f) => ({ ...f, contact_email: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all" />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block font-medium">Phone</label>
                          <input type="tel" placeholder="+1 (555) 000-0000" value={contactForm.contact_phone}
                            onChange={(e) => setContactForm((f) => ({ ...f, contact_phone: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all" />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-xs text-muted-foreground mb-1 block font-medium">Notes</label>
                          <input type="text" placeholder="Relationship notes, availability…" value={contactForm.notes}
                            onChange={(e) => setContactForm((f) => ({ ...f, notes: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all" />
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button onClick={() => setShowContactForm(false)}
                          className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:text-foreground transition-all">
                          Cancel
                        </button>
                        <button onClick={handleSaveContact} disabled={savingContact}
                          className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
                          style={{ background: '#355E3B', color: '#fff' }}>
                          {savingContact ? (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                          ) : null}
                          {savingContact ? 'Linking…' : 'Link Contact'}
                        </button>
                      </div>
                    </div>
                  )}

                  {contacts.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground text-sm">
                      No contacts linked. Add co-counsel, witnesses, or other parties.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {contacts.map((contact) => (
                        <div key={contact.id} className="flex items-start justify-between gap-4 p-4 rounded-xl border border-border bg-secondary/20">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0 text-accent font-semibold text-sm">
                              {contact.contact_name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium text-foreground text-sm">{contact.contact_name}</p>
                                <span className="text-xs text-muted-foreground bg-secondary/60 px-2 py-0.5 rounded-full">
                                  {CONTACT_ROLE_LABELS[contact.contact_role] ?? contact.contact_role}
                                </span>
                              </div>
                              {contact.contact_email && (
                                <a href={`mailto:${contact.contact_email}`} className="text-xs text-accent hover:underline mt-0.5 block">{contact.contact_email}</a>
                              )}
                              {contact.contact_phone && (
                                <p className="text-xs text-muted-foreground mt-0.5">{contact.contact_phone}</p>
                              )}
                              {contact.notes && (
                                <p className="text-xs text-muted-foreground/70 mt-1 italic">{contact.notes}</p>
                              )}
                            </div>
                          </div>
                          <button onClick={() => handleDeleteContact(contact.id)}
                            className="p-1.5 rounded-lg border border-border text-muted-foreground/40 hover:text-red-500 hover:border-red-300 transition-all flex-shrink-0">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Documents Tab ── */}
              {detailTab === 'documents' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-foreground">{documents.length} Document{documents.length !== 1 ? 's' : ''}</h3>
                    <Link href={`/admin/cases/${selectedCase.id}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90"
                      style={{ background: '#355E3B', color: '#fff' }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Upload Document
                    </Link>
                  </div>

                  {docLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-muted/30 rounded-xl animate-pulse" />)}
                    </div>
                  ) : documents.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground text-sm">
                      No documents yet.{' '}
                      <Link href={`/admin/cases/${selectedCase.id}`} className="text-accent hover:underline">
                        Open full case view
                      </Link>{' '}
                      to upload documents.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {documents.map((doc) => (
                        <div key={doc.id} className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-secondary/20 hover:bg-secondary/30 transition-colors">
                          <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium text-foreground truncate">{doc.file_name}</p>
                              {doc.requires_client_review && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
                                  Review
                                </span>
                              )}
                              {doc.document_type && (
                                <span className="text-xs text-muted-foreground bg-secondary/60 px-2 py-0.5 rounded-full">{doc.document_type}</span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {doc.category && <>{doc.category} · </>}
                              {formatFileSize(doc.file_size)}
                              {doc.file_size ? ' · ' : ''}
                              {formatDate(doc.created_at)}
                            </p>
                          </div>
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                            className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-accent hover:border-accent/40 transition-all flex-shrink-0">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
