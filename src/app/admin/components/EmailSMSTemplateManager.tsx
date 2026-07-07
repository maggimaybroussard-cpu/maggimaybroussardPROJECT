'use client';

import React, { useState, useCallback, useEffect } from 'react';

import toast from 'react-hot-toast';

// ── Types ─────────────────────────────────────────────────────────────────────

type TemplateChannel = 'email' | 'sms';
type TemplateCategory = 'intake' | 'case_update' | 'invoice' | 'reminder' | 'milestone' | 'onboarding' | 'marketing' | 'custom';

interface Template {
  id: string;
  name: string;
  channel: TemplateChannel;
  category: TemplateCategory;
  subject?: string;
  body: string;
  variables: string[];
  isActive: boolean;
  lastUsed?: string;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface SendTestPayload {
  to: string;
  subject?: string;
  body: string;
  channel: TemplateChannel;
}

// ── Default Templates ─────────────────────────────────────────────────────────

const DEFAULT_TEMPLATES: Omit<Template, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'New Client Welcome',
    channel: 'email',
    category: 'onboarding',
    subject: 'Welcome to Broussard Legal Services, {{clientName}}!',
    body: `Dear {{clientName}},

Welcome to Broussard Legal Services! We're honored to represent you in your {{matterType}} matter.

Here's what to expect next:
• You'll receive a link to your secure client portal within 24 hours
• Your engagement letter will be sent for digital signature
• Our team will reach out to schedule your initial strategy session

If you have any questions, please don't hesitate to reach out.

Warm regards,
Maggi May Broussard, Esq.
Broussard Legal Services
(504) 458-2831`,
    variables: ['clientName', 'matterType'],
    isActive: true,
    usageCount: 0,
  },
  {
    name: 'Case Status Update',
    channel: 'email',
    category: 'case_update',
    subject: 'Case Update — {{caseTitle}}',
    body: `Dear {{clientName}},

I wanted to provide you with a brief update on your {{matterType}} matter.

Current Status: {{caseStatus}}

Recent Activity:
{{recentActivity}}

Next Steps:
{{nextSteps}}

Your next deadline is {{nextDeadline}}. Please ensure any required documents are submitted by then.

Please log into your client portal to view full case details and documents.

Best regards,
Maggi May Broussard, Esq.`,
    variables: ['clientName', 'caseTitle', 'matterType', 'caseStatus', 'recentActivity', 'nextSteps', 'nextDeadline'],
    isActive: true,
    usageCount: 0,
  },
  {
    name: 'Invoice Issued',
    channel: 'email',
    category: 'invoice',
    subject: 'Invoice #{{invoiceNumber}} — {{amount}} Due {{dueDate}}',
    body: `Dear {{clientName}},

Please find attached Invoice #{{invoiceNumber}} for services rendered in connection with your {{matterType}} matter.

Invoice Details:
• Invoice Number: {{invoiceNumber}}
• Amount Due: {{amount}}
• Due Date: {{dueDate}}
• Services: {{serviceDescription}}

You may pay securely online at: {{paymentLink}}

We accept credit cards, ACH bank transfer, and payment plans. Please contact us if you need to discuss payment arrangements.

Thank you for your prompt attention.

Maggi May Broussard, Esq.
Broussard Legal Services`,
    variables: ['clientName', 'invoiceNumber', 'amount', 'dueDate', 'matterType', 'serviceDescription', 'paymentLink'],
    isActive: true,
    usageCount: 0,
  },
  {
    name: 'Deadline Reminder',
    channel: 'email',
    category: 'reminder',
    subject: '⚠️ Upcoming Deadline — {{deadlineTitle}} on {{deadlineDate}}',
    body: `Dear {{clientName}},

This is a reminder that an important deadline is approaching in your {{matterType}} matter.

Deadline: {{deadlineTitle}}
Date: {{deadlineDate}}
Days Remaining: {{daysRemaining}}

Action Required:
{{actionRequired}}

Please ensure all required materials are submitted at least 48 hours before the deadline. Log into your client portal to upload documents or send a message.

If you have any questions, please contact us immediately.

Maggi May Broussard, Esq.
(504) 458-2831`,
    variables: ['clientName', 'deadlineTitle', 'deadlineDate', 'daysRemaining', 'matterType', 'actionRequired'],
    isActive: true,
    usageCount: 0,
  },
  {
    name: 'Retainer Milestone Alert',
    channel: 'email',
    category: 'milestone',
    subject: 'Retainer Milestone — {{milestoneName}}',
    body: `Dear {{clientName}},

We're pleased to inform you that your matter has reached an important milestone.

Milestone: {{milestoneName}}
Date Achieved: {{milestoneDate}}
Matter: {{matterType}}

Summary:
{{milestoneSummary}}

Next Phase:
{{nextPhase}}

Your retainer balance is currently {{retainerBalance}}. {{retainerNote}}

Please log into your portal to review updated case documents.

Best regards,
Maggi May Broussard, Esq.`,
    variables: ['clientName', 'milestoneName', 'milestoneDate', 'matterType', 'milestoneSummary', 'nextPhase', 'retainerBalance', 'retainerNote'],
    isActive: true,
    usageCount: 0,
  },
  {
    name: 'Appointment Reminder',
    channel: 'sms',
    category: 'reminder',
    body: `Hi {{clientName}}, this is a reminder of your {{appointmentType}} with Broussard Legal Services on {{appointmentDate}} at {{appointmentTime}}. Reply CONFIRM to confirm or call (504) 458-2831 to reschedule.`,
    variables: ['clientName', 'appointmentType', 'appointmentDate', 'appointmentTime'],
    isActive: true,
    usageCount: 0,
  },
  {
    name: 'Payment Due SMS',
    channel: 'sms',
    category: 'invoice',
    body: `Hi {{clientName}}, Invoice #{{invoiceNumber}} for \${{amount}} is due on {{dueDate}}. Pay securely: {{paymentLink}} — Broussard Legal Services`,
    variables: ['clientName', 'invoiceNumber', 'amount', 'dueDate', 'paymentLink'],
    isActive: true,
    usageCount: 0,
  },
  {
    name: 'Urgent Deadline SMS',
    channel: 'sms',
    category: 'reminder',
    body: `URGENT: {{clientName}}, your {{deadlineTitle}} deadline is {{daysRemaining}} day(s) away ({{deadlineDate}}). Action required. Call (504) 458-2831 immediately.`,
    variables: ['clientName', 'deadlineTitle', 'daysRemaining', 'deadlineDate'],
    isActive: true,
    usageCount: 0,
  },
  {
    name: 'Case Closed',
    channel: 'email',
    category: 'case_update',
    subject: 'Matter Closed — {{caseTitle}}',
    body: `Dear {{clientName}},

We are pleased to inform you that your {{matterType}} matter has been successfully closed.

Matter: {{caseTitle}}
Closed Date: {{closedDate}}
Outcome: {{outcome}}

It has been our privilege to represent you. A final invoice and case summary will be sent within 5 business days.

Please retain all documents provided during this engagement for your records.

We hope to work with you again in the future. Please don't hesitate to refer friends and family who may need legal assistance.

With gratitude,
Maggi May Broussard, Esq.
Broussard Legal Services`,
    variables: ['clientName', 'caseTitle', 'matterType', 'closedDate', 'outcome'],
    isActive: true,
    usageCount: 0,
  },
];

const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  intake: 'Intake',
  case_update: 'Case Update',
  invoice: 'Invoice',
  reminder: 'Reminder',
  milestone: 'Milestone',
  onboarding: 'Onboarding',
  marketing: 'Marketing',
  custom: 'Custom',
};

const CATEGORY_COLORS: Record<TemplateCategory, string> = {
  intake: 'bg-blue-50 text-blue-700 border-blue-200',
  case_update: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  invoice: 'bg-amber-50 text-amber-700 border-amber-200',
  reminder: 'bg-red-50 text-red-700 border-red-200',
  milestone: 'bg-purple-50 text-purple-700 border-purple-200',
  onboarding: 'bg-sky-50 text-sky-700 border-sky-200',
  marketing: 'bg-pink-50 text-pink-700 border-pink-200',
  custom: 'bg-gray-100 text-gray-600 border-gray-200',
};

// ── Main Component ─────────────────────────────────────────────────────────────

export default function EmailSMSTemplateManager() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [activeChannel, setActiveChannel] = useState<'all' | TemplateChannel>('all');
  const [activeCategory, setActiveCategory] = useState<'all' | TemplateCategory>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [testTo, setTestTo] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [previewVars, setPreviewVars] = useState<Record<string, string>>({});

  const [editForm, setEditForm] = useState<Partial<Template>>({
    name: '',
    channel: 'email',
    category: 'custom',
    subject: '',
    body: '',
    isActive: true,
  });

  // Initialize with default templates
  useEffect(() => {
    const stored = localStorage.getItem('bls_email_sms_templates');
    if (stored) {
      try {
        setTemplates(JSON.parse(stored));
      } catch {
        initDefaults();
      }
    } else {
      initDefaults();
    }
  }, []);

  const initDefaults = () => {
    const now = new Date().toISOString();
    const initialized = DEFAULT_TEMPLATES.map((t, i) => ({
      ...t,
      id: `default_${i}_${Date.now()}`,
      createdAt: now,
      updatedAt: now,
    }));
    setTemplates(initialized);
    localStorage.setItem('bls_email_sms_templates', JSON.stringify(initialized));
  };

  const saveTemplates = useCallback((updated: Template[]) => {
    setTemplates(updated);
    localStorage.setItem('bls_email_sms_templates', JSON.stringify(updated));
  }, []);

  const handleSave = useCallback(() => {
    if (!editForm.name?.trim() || !editForm.body?.trim()) {
      toast.error('Name and body are required');
      return;
    }
    const now = new Date().toISOString();
    // Extract variables from body
    const varMatches = editForm.body.match(/\{\{(\w+)\}\}/g) ?? [];
    const variables = [...new Set(varMatches.map(v => v.replace(/\{\{|\}\}/g, '')))];

    if (isCreating) {
      const newTemplate: Template = {
        id: `custom_${Date.now()}`,
        name: editForm.name!,
        channel: editForm.channel as TemplateChannel,
        category: editForm.category as TemplateCategory,
        subject: editForm.subject,
        body: editForm.body!,
        variables,
        isActive: editForm.isActive ?? true,
        usageCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      saveTemplates([newTemplate, ...templates]);
      setSelectedTemplate(newTemplate);
      toast.success('Template created!');
    } else if (selectedTemplate) {
      const updated = templates.map(t =>
        t.id === selectedTemplate.id
          ? { ...t, ...editForm, variables, updatedAt: now }
          : t
      );
      saveTemplates(updated);
      const updatedTemplate = updated.find(t => t.id === selectedTemplate.id)!;
      setSelectedTemplate(updatedTemplate);
      toast.success('Template saved!');
    }
    setIsEditing(false);
    setIsCreating(false);
  }, [editForm, isCreating, selectedTemplate, templates, saveTemplates]);

  const handleDelete = useCallback((id: string) => {
    if (!confirm('Delete this template?')) return;
    const updated = templates.filter(t => t.id !== id);
    saveTemplates(updated);
    if (selectedTemplate?.id === id) setSelectedTemplate(null);
    toast.success('Template deleted');
  }, [templates, selectedTemplate, saveTemplates]);

  const handleToggleActive = useCallback((id: string) => {
    const updated = templates.map(t => t.id === id ? { ...t, isActive: !t.isActive } : t);
    saveTemplates(updated);
  }, [templates, saveTemplates]);

  const handleSendTest = useCallback(async () => {
    if (!selectedTemplate || !testTo.trim()) {
      toast.error('Enter a recipient first');
      return;
    }
    setSendingTest(true);
    try {
      // Replace variables with preview values
      let body = selectedTemplate.body;
      let subject = selectedTemplate.subject ?? '';
      Object.entries(previewVars).forEach(([key, val]) => {
        body = body.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val || `[${key}]`);
        subject = subject.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val || `[${key}]`);
      });

      if (selectedTemplate.channel === 'email') {
        const res = await fetch('/api/admin/send-resend-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: testTo, subject: subject || 'Test Email', html: body.replace(/\n/g, '<br>') }),
        });
        if (!res.ok) throw new Error('Failed to send test email');
        toast.success(`Test email sent to ${testTo}`);
      } else {
        const res = await fetch('/api/sms/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: testTo, body }),
        });
        if (!res.ok) throw new Error('Failed to send test SMS');
        toast.success(`Test SMS sent to ${testTo}`);
      }
      // Increment usage count
      const updated = templates.map(t =>
        t.id === selectedTemplate.id
          ? { ...t, usageCount: t.usageCount + 1, lastUsed: new Date().toISOString() }
          : t
      );
      saveTemplates(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send test');
    } finally {
      setSendingTest(false);
    }
  }, [selectedTemplate, testTo, previewVars, templates, saveTemplates]);

  const startCreate = () => {
    setEditForm({ name: '', channel: 'email', category: 'custom', subject: '', body: '', isActive: true });
    setIsCreating(true);
    setIsEditing(true);
    setSelectedTemplate(null);
  };

  const startEdit = (t: Template) => {
    setEditForm({ ...t });
    setIsEditing(true);
    setIsCreating(false);
  };

  const getPreview = (template: Template) => {
    let body = template.body;
    let subject = template.subject ?? '';
    template.variables.forEach(v => {
      const val = previewVars[v] || `[${v}]`;
      body = body.replace(new RegExp(`\\{\\{${v}\\}\\}`, 'g'), val);
      subject = subject.replace(new RegExp(`\\{\\{${v}\\}\\}`, 'g'), val);
    });
    return { body, subject };
  };

  const filtered = templates.filter(t => {
    if (activeChannel !== 'all' && t.channel !== activeChannel) return false;
    if (activeCategory !== 'all' && t.category !== activeCategory) return false;
    if (searchQuery && !t.name.toLowerCase().includes(searchQuery.toLowerCase()) && !t.body.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const emailCount = templates.filter(t => t.channel === 'email').length;
  const smsCount = templates.filter(t => t.channel === 'sms').length;
  const activeCount = templates.filter(t => t.isActive).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-serif text-xl text-foreground">Email & SMS Template Manager</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Create, edit, and send branded communication templates</p>
        </div>
        <button
          onClick={startCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all hover:opacity-90"
          style={{ background: '#355E3B', color: '#fff' }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New Template
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Email Templates', value: emailCount, color: '#2563EB' },
          { label: 'SMS Templates', value: smsCount, color: '#7C3AED' },
          { label: 'Active', value: activeCount, color: '#355E3B' },
        ].map(stat => (
          <div key={stat.label} className="bg-card border border-border rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Template List */}
        <div className="xl:col-span-2 space-y-4">
          {/* Filters */}
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search templates…"
              className="w-full px-3 py-2 rounded-xl border border-border bg-input text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
            <div className="flex gap-2">
              {(['all', 'email', 'sms'] as const).map(ch => (
                <button
                  key={ch}
                  onClick={() => setActiveChannel(ch)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeChannel === ch ? 'bg-foreground text-background' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
                >
                  {ch === 'all' ? 'All' : ch === 'email' ? '📧 Email' : '💬 SMS'}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(['all', 'intake', 'case_update', 'invoice', 'reminder', 'milestone', 'onboarding', 'custom'] as const).map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${activeCategory === cat ? 'bg-foreground text-background' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
                >
                  {cat === 'all' ? 'All' : CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          </div>

          {/* Template Cards */}
          <div className="space-y-2">
            {filtered.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-8 text-center">
                <p className="text-sm text-muted-foreground">No templates found</p>
              </div>
            ) : (
              filtered.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setSelectedTemplate(t); setIsEditing(false); setIsCreating(false); setPreviewVars({}); }}
                  className={`w-full bg-card border rounded-2xl p-4 text-left transition-all hover:border-accent/40 ${selectedTemplate?.id === t.id ? 'border-accent/60 bg-accent/5' : 'border-border'}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-sm font-semibold text-foreground truncate flex-1">{t.name}</p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${t.channel === 'email' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                        {t.channel === 'email' ? '📧' : '💬'}
                      </span>
                      <span className={`w-2 h-2 rounded-full ${t.isActive ? 'bg-emerald-500' : 'bg-gray-300'}`} title={t.isActive ? 'Active' : 'Inactive'} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${CATEGORY_COLORS[t.category]}`}>
                      {CATEGORY_LABELS[t.category]}
                    </span>
                    {t.usageCount > 0 && (
                      <span className="text-[10px] text-muted-foreground">{t.usageCount} sent</span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Template Detail / Editor */}
        <div className="xl:col-span-3">
          {!selectedTemplate && !isCreating ? (
            <div className="bg-card border border-border rounded-2xl p-12 text-center h-full flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-2xl bg-secondary/60 flex items-center justify-center mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                </svg>
              </div>
              <p className="text-sm font-medium text-foreground mb-1">Select a template to view or edit</p>
              <p className="text-xs text-muted-foreground">Or create a new template to get started</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              {/* Header */}
              <div className="px-5 py-4 border-b border-border bg-secondary/30 flex items-center justify-between">
                <h3 className="font-semibold text-foreground text-sm">
                  {isCreating ? 'New Template' : isEditing ? 'Edit Template' : selectedTemplate?.name}
                </h3>
                <div className="flex items-center gap-2">
                  {!isEditing && selectedTemplate && (
                    <>
                      <button
                        onClick={() => handleToggleActive(selectedTemplate.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${selectedTemplate.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-600 border border-gray-200'}`}
                      >
                        {selectedTemplate.isActive ? 'Active' : 'Inactive'}
                      </button>
                      <button
                        onClick={() => startEdit(selectedTemplate)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-secondary text-foreground hover:bg-secondary/80 transition-all"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(selectedTemplate.id)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 transition-all"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
                        </svg>
                      </button>
                    </>
                  )}
                  {isEditing && (
                    <>
                      <button
                        onClick={handleSave}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90"
                        style={{ background: '#355E3B', color: '#fff' }}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => { setIsEditing(false); setIsCreating(false); }}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-secondary text-muted-foreground hover:text-foreground transition-all"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="p-5 space-y-4">
                {isEditing ? (
                  /* Edit Form */
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Template Name</label>
                        <input
                          type="text"
                          value={editForm.name ?? ''}
                          onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                          className="w-full px-3 py-2 rounded-xl border border-border bg-input text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
                          placeholder="e.g. New Client Welcome"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Channel</label>
                        <select
                          value={editForm.channel ?? 'email'}
                          onChange={e => setEditForm(f => ({ ...f, channel: e.target.value as TemplateChannel }))}
                          className="w-full px-3 py-2 rounded-xl border border-border bg-input text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
                        >
                          <option value="email">📧 Email</option>
                          <option value="sms">💬 SMS</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Category</label>
                      <select
                        value={editForm.category ?? 'custom'}
                        onChange={e => setEditForm(f => ({ ...f, category: e.target.value as TemplateCategory }))}
                        className="w-full px-3 py-2 rounded-xl border border-border bg-input text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
                      >
                        {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </div>
                    {editForm.channel === 'email' && (
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Subject Line</label>
                        <input
                          type="text"
                          value={editForm.subject ?? ''}
                          onChange={e => setEditForm(f => ({ ...f, subject: e.target.value }))}
                          className="w-full px-3 py-2 rounded-xl border border-border bg-input text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
                          placeholder="Use {{variableName}} for dynamic content"
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">
                        Body {editForm.channel === 'sms' && <span className="text-muted-foreground/60 normal-case font-normal">(160 chars per segment)</span>}
                      </label>
                      <textarea
                        value={editForm.body ?? ''}
                        onChange={e => setEditForm(f => ({ ...f, body: e.target.value }))}
                        rows={editForm.channel === 'sms' ? 4 : 12}
                        className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent/40 resize-none"
                        placeholder="Use {{variableName}} for dynamic content"
                      />
                      {editForm.channel === 'sms' && (
                        <p className="text-xs text-muted-foreground mt-1">{editForm.body?.length ?? 0} characters</p>
                      )}
                    </div>
                    <div className="bg-secondary/40 rounded-xl p-3">
                      <p className="text-xs text-muted-foreground">
                        <span className="font-semibold">Variables detected:</span>{' '}
                        {(editForm.body?.match(/\{\{(\w+)\}\}/g) ?? []).map(v => v.replace(/\{\{|\}\}/g, '')).join(', ') || 'None'}
                      </p>
                    </div>
                  </>
                ) : selectedTemplate ? (
                  /* View Mode */
                  <>
                    <div className="flex flex-wrap gap-2 mb-2">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${CATEGORY_COLORS[selectedTemplate.category]}`}>
                        {CATEGORY_LABELS[selectedTemplate.category]}
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${selectedTemplate.channel === 'email' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-purple-50 text-purple-700 border border-purple-200'}`}>
                        {selectedTemplate.channel === 'email' ? '📧 Email' : '💬 SMS'}
                      </span>
                      {selectedTemplate.usageCount > 0 && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-secondary text-muted-foreground border border-border">
                          {selectedTemplate.usageCount} sent
                        </span>
                      )}
                    </div>

                    {/* Variables Preview */}
                    {selectedTemplate.variables.length > 0 && (
                      <div className="bg-secondary/40 rounded-xl p-4">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Preview Variables</p>
                        <div className="grid grid-cols-2 gap-2">
                          {selectedTemplate.variables.map(v => (
                            <div key={v}>
                              <label className="block text-[10px] text-muted-foreground mb-1">{`{{${v}}}`}</label>
                              <input
                                type="text"
                                value={previewVars[v] ?? ''}
                                onChange={e => setPreviewVars(prev => ({ ...prev, [v]: e.target.value }))}
                                placeholder={`Enter ${v}`}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-input text-xs focus:outline-none focus:ring-1 focus:ring-accent/40"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Preview */}
                    <div>
                      {selectedTemplate.channel === 'email' && (
                        <div className="mb-3">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Subject</p>
                          <p className="text-sm font-medium text-foreground bg-secondary/40 rounded-xl px-4 py-2.5">
                            {getPreview(selectedTemplate).subject || '(no subject)'}
                          </p>
                        </div>
                      )}
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Body Preview</p>
                      <div className="bg-secondary/20 rounded-xl p-4 border border-border max-h-64 overflow-y-auto">
                        <pre className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap font-sans">
                          {getPreview(selectedTemplate).body}
                        </pre>
                      </div>
                    </div>

                    {/* Send Test */}
                    <div className="border-t border-border pt-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Send Test</p>
                      <div className="flex gap-2">
                        <input
                          type={selectedTemplate.channel === 'email' ? 'email' : 'tel'}
                          value={testTo}
                          onChange={e => setTestTo(e.target.value)}
                          placeholder={selectedTemplate.channel === 'email' ? 'test@example.com' : '+15041234567'}
                          className="flex-1 px-3 py-2 rounded-xl border border-border bg-input text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
                        />
                        <button
                          onClick={handleSendTest}
                          disabled={sendingTest || !testTo.trim()}
                          className="px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all disabled:opacity-50 hover:opacity-90 flex items-center gap-1.5"
                          style={{ background: '#355E3B', color: '#fff' }}
                        >
                          {sendingTest ? (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                            </svg>
                          ) : (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                            </svg>
                          )}
                          Send Test
                        </button>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
