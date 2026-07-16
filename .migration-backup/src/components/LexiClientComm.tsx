'use client';

import React, { useState, useEffect } from 'react';
import { getChatCompletion } from '@/lib/ai/chatCompletion';

import toast from 'react-hot-toast';

// ── Types ─────────────────────────────────────────────────────────────────────

type CommTab = 'status_updates' | 'welcome_packet' | 'followup_nudge' | 'history';
type UpdateFrequency = 'weekly' | 'biweekly' | 'monthly';

interface StatusUpdateForm {
  clientName: string;
  clientEmail: string;
  caseRef: string;
  matterType: string;
  recentActivity: string;
  nextSteps: string;
  frequency: UpdateFrequency;
}

interface WelcomePacketForm {
  clientName: string;
  clientEmail: string;
  matterType: string;
  assignedAttorney: string;
  caseRef: string;
  firstAppointmentDate: string;
  portalUrl: string;
}

interface CommLog {
  id: string;
  type: string;
  clientName: string;
  clientEmail: string;
  subject: string;
  preview: string;
  sentAt: string;
  status: 'sent' | 'draft' | 'scheduled';
}

const MATTER_TYPES = ['Personal Injury', 'Business Law', 'Employment Law', 'Real Estate', 'Estate Planning', 'Contract Dispute', 'Litigation', 'Other'];

export default function LexiClientComm({ prefillClientName, prefillCaseRef }: { prefillClientName?: string; prefillCaseRef?: string }) {
  const [activeTab, setActiveTab] = useState<CommTab>('status_updates');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedEmail, setGeneratedEmail] = useState('');
  const [generatedSubject, setGeneratedSubject] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [commLogs, setCommLogs] = useState<CommLog[]>([]);

  const [statusForm, setStatusForm] = useState<StatusUpdateForm>({
    clientName: prefillClientName || '',
    clientEmail: '',
    caseRef: prefillCaseRef || '',
    matterType: 'Personal Injury',
    recentActivity: '',
    nextSteps: '',
    frequency: 'monthly',
  });

  const [welcomeForm, setWelcomeForm] = useState<WelcomePacketForm>({
    clientName: prefillClientName || '',
    clientEmail: '',
    matterType: 'Personal Injury',
    assignedAttorney: 'Attorney Broussard',
    caseRef: prefillCaseRef || '',
    firstAppointmentDate: '',
    portalUrl: 'https://broussardlegalservices.com/portal/login',
  });

  const [followupForm, setFollowupForm] = useState({
    clientName: prefillClientName || '',
    clientEmail: '',
    caseRef: prefillCaseRef || '',
    lastContactDate: '',
    pendingItem: '',
    urgency: 'standard\' as \'urgent\' | \'standard\' | \'gentle',
  });

  useEffect(() => {
    const stored = localStorage.getItem('lexi_comm_logs');
    if (stored) {
      try { setCommLogs(JSON.parse(stored)); } catch { setCommLogs([]); }
    }
  }, []);

  const saveLog = (log: CommLog) => {
    const updated = [log, ...commLogs].slice(0, 50);
    localStorage.setItem('lexi_comm_logs', JSON.stringify(updated));
    setCommLogs(updated);
  };

  const generateStatusUpdate = async () => {
    if (!statusForm.clientName || !statusForm.recentActivity) {
      toast.error('Please fill in client name and recent activity');
      return;
    }
    setIsGenerating(true);
    try {
      const prompt = `You are Lexi, a professional legal secretary at Broussard Legal Services. Draft a professional client status update email.

CLIENT: ${statusForm.clientName}
MATTER: ${statusForm.caseRef || 'General Matter'} — ${statusForm.matterType}
RECENT ACTIVITY: ${statusForm.recentActivity}
NEXT STEPS: ${statusForm.nextSteps || 'To be determined'}
UPDATE FREQUENCY: ${statusForm.frequency}

Draft a warm, professional status update email that:
1. Opens with a personalized greeting
2. Summarizes recent activity in plain language (no jargon)
3. Clearly explains next steps and what the client should expect
4. Includes a reassuring closing that reinforces the firm's commitment
5. Signs off as "Lexi, on behalf of Broussard Legal Services" 6. Subject line:"Case Update — [Matter Reference] — [Month Year]"

Format: Subject: [subject line]\n\n[email body]`;

      const result = await getChatCompletion([{ role: 'user', content: prompt }], { model: 'gpt-4o-mini', temperature: 0.4, max_tokens: 800 });
      const lines = (result || '').split('\n');
      const subjectLine = lines.find(l => l.startsWith('Subject:'))?.replace('Subject:', '').trim() || `Case Update — ${statusForm.caseRef}`;
      const body = lines.filter(l => !l.startsWith('Subject:')).join('\n').trim();
      setGeneratedSubject(subjectLine);
      setGeneratedEmail(body);
      setShowPreview(true);
    } catch {
      toast.error('Generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const generateWelcomePacket = async () => {
    if (!welcomeForm.clientName) { toast.error('Please enter client name'); return; }
    setIsGenerating(true);
    try {
      const prompt = `You are Lexi, a professional legal secretary at Broussard Legal Services. Draft a comprehensive new client welcome packet email.

CLIENT: ${welcomeForm.clientName}
MATTER TYPE: ${welcomeForm.matterType}
ASSIGNED ATTORNEY: ${welcomeForm.assignedAttorney}
CASE REFERENCE: ${welcomeForm.caseRef || '[To be assigned]'}
FIRST APPOINTMENT: ${welcomeForm.firstAppointmentDate || '[To be scheduled]'}
CLIENT PORTAL: ${welcomeForm.portalUrl}

Draft a warm, professional welcome email that includes:
1. Warm welcome and introduction to the firm
2. What to expect during the legal process (general overview for ${welcomeForm.matterType})
3. How to access the client portal and what they'll find there
4. What documents to gather and bring to the first appointment
5. How to reach the firm (phone, email, portal messaging)
6. Billing and communication expectations
7. A reassuring, confidence-building closing
8. Sign off as "Lexi, Legal Secretary — Broussard Legal Services"

Subject: Welcome to Broussard Legal Services — Your Matter Reference: ${welcomeForm.caseRef || '[Pending]'}

Format: Subject: [subject]\n\n[email body]`;

      const result = await getChatCompletion([{ role: 'user', content: prompt }], { model: 'gpt-4o-mini', temperature: 0.4, max_tokens: 1000 });
      const lines = (result || '').split('\n');
      const subjectLine = lines.find(l => l.startsWith('Subject:'))?.replace('Subject:', '').trim() || `Welcome to Broussard Legal Services`;
      const body = lines.filter(l => !l.startsWith('Subject:')).join('\n').trim();
      setGeneratedSubject(subjectLine);
      setGeneratedEmail(body);
      setShowPreview(true);
    } catch {
      toast.error('Generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const generateFollowup = async () => {
    if (!followupForm.clientName) { toast.error('Please enter client name'); return; }
    setIsGenerating(true);
    try {
      const urgencyMap = { urgent: 'urgent and time-sensitive', standard: 'professional and friendly', gentle: 'gentle and non-pressuring' };
      const prompt = `You are Lexi, a professional legal secretary at Broussard Legal Services. Draft a follow-up email to a client who has not responded in 30 days.

CLIENT: ${followupForm.clientName}
CASE REF: ${followupForm.caseRef || 'General Matter'}
LAST CONTACT: ${followupForm.lastContactDate || '30+ days ago'}
PENDING ITEM: ${followupForm.pendingItem || 'Pending response / documents / decision'}
TONE: ${urgencyMap[followupForm.urgency]}

Draft a ${urgencyMap[followupForm.urgency]} follow-up email that:
1. References the pending item clearly
2. Explains why the client's response is needed
3. Offers easy ways to respond (call, email, portal)
4. ${followupForm.urgency === 'urgent' ? 'Notes any deadline implications' : 'Keeps a warm, supportive tone'}
5. Signs off as "Lexi, on behalf of Broussard Legal Services"

Subject: Following Up — ${followupForm.caseRef || 'Your Matter'} — Action Needed

Format: Subject: [subject]\n\n[email body]`;

      const result = await getChatCompletion([{ role: 'user', content: prompt }], { model: 'gpt-4o-mini', temperature: 0.4, max_tokens: 600 });
      const lines = (result || '').split('\n');
      const subjectLine = lines.find(l => l.startsWith('Subject:'))?.replace('Subject:', '').trim() || `Following Up — ${followupForm.caseRef}`;
      const body = lines.filter(l => !l.startsWith('Subject:')).join('\n').trim();
      setGeneratedSubject(subjectLine);
      setGeneratedEmail(body);
      setShowPreview(true);
    } catch {
      toast.error('Generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyEmail = () => {
    navigator.clipboard.writeText(`Subject: ${generatedSubject}\n\n${generatedEmail}`);
    toast.success('Email copied to clipboard');
    const clientName = activeTab === 'status_updates' ? statusForm.clientName : activeTab === 'welcome_packet' ? welcomeForm.clientName : followupForm.clientName;
    const log: CommLog = {
      id: Date.now().toString(),
      type: activeTab === 'status_updates' ? 'Status Update' : activeTab === 'welcome_packet' ? 'Welcome Packet' : 'Follow-up Nudge',
      clientName,
      clientEmail: '',
      subject: generatedSubject,
      preview: generatedEmail.substring(0, 100) + '…',
      sentAt: new Date().toISOString(),
      status: 'draft',
    };
    saveLog(log);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-secondary/30 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-lg">📬</span>
          <div>
            <p className="text-sm font-semibold text-foreground">Client Communication Automation</p>
            <p className="text-[10px] text-muted-foreground">Status updates, welcome packets, and follow-up nudges</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border shrink-0">
        {([
          { id: 'status_updates', label: '📋 Status Update' },
          { id: 'welcome_packet', label: '🎉 Welcome' },
          { id: 'followup_nudge', label: '🔔 Follow-up' },
          { id: 'history', label: '📜 History' },
        ] as const).map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); setShowPreview(false); }}
            className={`flex-1 py-2 text-[10px] font-semibold transition-colors ${activeTab === tab.id ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Email Preview Overlay */}
      {showPreview && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 py-2 border-b border-border bg-green-50 flex items-center justify-between shrink-0">
            <p className="text-xs font-semibold text-green-800">✓ Email Draft Ready</p>
            <div className="flex gap-2">
              <button onClick={copyEmail} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700">📋 Copy Email</button>
              <button onClick={() => setShowPreview(false)} className="px-3 py-1.5 bg-secondary border border-border text-foreground rounded-lg text-xs font-semibold">← Edit</button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="border-b border-border pb-3 mb-3">
                <p className="text-[10px] text-muted-foreground">Subject:</p>
                <p className="text-xs font-semibold text-foreground">{generatedSubject}</p>
              </div>
              <textarea value={generatedEmail} onChange={e => setGeneratedEmail(e.target.value)}
                className="w-full bg-transparent text-xs text-foreground leading-relaxed resize-none focus:outline-none min-h-[300px]" />
            </div>
          </div>
        </div>
      )}

      {/* Status Updates Tab */}
      {!showPreview && activeTab === 'status_updates' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
            <p className="text-[10px] text-blue-700 font-semibold">📋 Scheduled Status Updates</p>
            <p className="text-[10px] text-blue-600 mt-0.5">Draft a professional status update email for any active matter. Copy and send via your email client.</p>
          </div>
          {[
            { id: 'clientName', label: 'Client Name', type: 'text', placeholder: 'John A. Smith', value: statusForm.clientName, onChange: (v: string) => setStatusForm(f => ({ ...f, clientName: v })) },
            { id: 'clientEmail', label: 'Client Email', type: 'email', placeholder: 'client@email.com', value: statusForm.clientEmail, onChange: (v: string) => setStatusForm(f => ({ ...f, clientEmail: v })) },
            { id: 'caseRef', label: 'Case Reference', type: 'text', placeholder: '2024-PI-001', value: statusForm.caseRef, onChange: (v: string) => setStatusForm(f => ({ ...f, caseRef: v })) },
          ].map(field => (
            <div key={field.id}>
              <label className="text-xs font-semibold text-foreground mb-1 block">{field.label}</label>
              <input type={field.type} value={field.value} onChange={e => field.onChange(e.target.value)} placeholder={field.placeholder}
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          ))}
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">Matter Type</label>
            <select value={statusForm.matterType} onChange={e => setStatusForm(f => ({ ...f, matterType: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
              {MATTER_TYPES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">Recent Activity <span className="text-red-500">*</span></label>
            <textarea value={statusForm.recentActivity} onChange={e => setStatusForm(f => ({ ...f, recentActivity: e.target.value }))}
              placeholder="What has happened recently on this matter? (filings, negotiations, discovery, etc.)" rows={3}
              className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">Next Steps</label>
            <textarea value={statusForm.nextSteps} onChange={e => setStatusForm(f => ({ ...f, nextSteps: e.target.value }))}
              placeholder="What happens next? What does the client need to know or do?" rows={2}
              className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">Update Frequency</label>
            <select value={statusForm.frequency} onChange={e => setStatusForm(f => ({ ...f, frequency: e.target.value as UpdateFrequency }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value="weekly">Weekly</option>
              <option value="biweekly">Bi-weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <button onClick={generateStatusUpdate} disabled={isGenerating || !statusForm.clientName || !statusForm.recentActivity}
            className="w-full py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors">
            {isGenerating ? 'Drafting…' : 'Draft Status Update →'}
          </button>
        </div>
      )}

      {/* Welcome Packet Tab */}
      {!showPreview && activeTab === 'welcome_packet' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="bg-green-50 border border-green-200 rounded-xl p-3">
            <p className="text-[10px] text-green-700 font-semibold">🎉 New Client Welcome Packet</p>
            <p className="text-[10px] text-green-600 mt-0.5">Auto-drafted after engagement letter is signed. Includes portal access, what to expect, and document checklist.</p>
          </div>
          {[
            { id: 'clientName', label: 'Client Name *', type: 'text', placeholder: 'John A. Smith', value: welcomeForm.clientName, onChange: (v: string) => setWelcomeForm(f => ({ ...f, clientName: v })) },
            { id: 'clientEmail', label: 'Client Email', type: 'email', placeholder: 'client@email.com', value: welcomeForm.clientEmail, onChange: (v: string) => setWelcomeForm(f => ({ ...f, clientEmail: v })) },
            { id: 'caseRef', label: 'Case Reference', type: 'text', placeholder: '2024-PI-001', value: welcomeForm.caseRef, onChange: (v: string) => setWelcomeForm(f => ({ ...f, caseRef: v })) },
            { id: 'assignedAttorney', label: 'Assigned Attorney', type: 'text', placeholder: 'Attorney Broussard', value: welcomeForm.assignedAttorney, onChange: (v: string) => setWelcomeForm(f => ({ ...f, assignedAttorney: v })) },
          ].map(field => (
            <div key={field.id}>
              <label className="text-xs font-semibold text-foreground mb-1 block">{field.label}</label>
              <input type={field.type} value={field.value} onChange={e => field.onChange(e.target.value)} placeholder={field.placeholder}
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          ))}
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">Matter Type</label>
            <select value={welcomeForm.matterType} onChange={e => setWelcomeForm(f => ({ ...f, matterType: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
              {MATTER_TYPES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">First Appointment Date</label>
            <input type="date" value={welcomeForm.firstAppointmentDate} onChange={e => setWelcomeForm(f => ({ ...f, firstAppointmentDate: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <button onClick={generateWelcomePacket} disabled={isGenerating || !welcomeForm.clientName}
            className="w-full py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors">
            {isGenerating ? 'Drafting…' : 'Generate Welcome Packet →'}
          </button>
        </div>
      )}

      {/* Follow-up Nudge Tab */}
      {!showPreview && activeTab === 'followup_nudge' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-[10px] text-amber-700 font-semibold">🔔 30-Day Follow-up Nudge</p>
            <p className="text-[10px] text-amber-600 mt-0.5">Automated follow-up when a client hasn't responded in 30 days. Choose tone based on urgency.</p>
          </div>
          {[
            { id: 'clientName', label: 'Client Name *', type: 'text', placeholder: 'John A. Smith', value: followupForm.clientName, onChange: (v: string) => setFollowupForm(f => ({ ...f, clientName: v })) },
            { id: 'clientEmail', label: 'Client Email', type: 'email', placeholder: 'client@email.com', value: followupForm.clientEmail, onChange: (v: string) => setFollowupForm(f => ({ ...f, clientEmail: v })) },
            { id: 'caseRef', label: 'Case Reference', type: 'text', placeholder: '2024-PI-001', value: followupForm.caseRef, onChange: (v: string) => setFollowupForm(f => ({ ...f, caseRef: v })) },
            { id: 'lastContactDate', label: 'Last Contact Date', type: 'date', placeholder: '', value: followupForm.lastContactDate, onChange: (v: string) => setFollowupForm(f => ({ ...f, lastContactDate: v })) },
          ].map(field => (
            <div key={field.id}>
              <label className="text-xs font-semibold text-foreground mb-1 block">{field.label}</label>
              <input type={field.type} value={field.value} onChange={e => field.onChange(e.target.value)} placeholder={field.placeholder}
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          ))}
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">Pending Item</label>
            <textarea value={followupForm.pendingItem} onChange={e => setFollowupForm(f => ({ ...f, pendingItem: e.target.value }))}
              placeholder="What is the client not responding about? (documents needed, decision pending, etc.)" rows={2}
              className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">Tone</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { id: 'gentle', label: '😊 Gentle', desc: 'Soft check-in' },
                { id: 'standard', label: '📋 Standard', desc: 'Professional' },
                { id: 'urgent', label: '🚨 Urgent', desc: 'Time-sensitive' },
              ] as const).map(tone => (
                <button key={tone.id} onClick={() => setFollowupForm(f => ({ ...f, urgency: tone.id }))}
                  className={`p-2 rounded-xl border text-center transition-all ${followupForm.urgency === tone.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}>
                  <p className="text-xs font-semibold text-foreground">{tone.label}</p>
                  <p className="text-[9px] text-muted-foreground">{tone.desc}</p>
                </button>
              ))}
            </div>
          </div>
          <button onClick={generateFollowup} disabled={isGenerating || !followupForm.clientName}
            className="w-full py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors">
            {isGenerating ? 'Drafting…' : 'Generate Follow-up Email →'}
          </button>
        </div>
      )}

      {/* History Tab */}
      {!showPreview && activeTab === 'history' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {commLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <span className="text-3xl mb-2">📬</span>
              <p className="text-sm font-semibold text-foreground">No communication history</p>
              <p className="text-xs text-muted-foreground mt-1">Drafted emails will appear here</p>
            </div>
          ) : (
            commLogs.map(log => (
              <div key={log.id} className="p-3 bg-card border border-border rounded-xl">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="px-1.5 py-0.5 bg-secondary text-muted-foreground rounded text-[9px] font-semibold">{log.type}</span>
                      <span className="text-xs font-semibold text-foreground truncate">{log.clientName}</span>
                    </div>
                    <p className="text-[10px] text-foreground font-medium truncate">{log.subject}</p>
                    <p className="text-[9px] text-muted-foreground mt-0.5 truncate">{log.preview}</p>
                  </div>
                  <p className="text-[9px] text-muted-foreground shrink-0">{new Date(log.sentAt).toLocaleDateString()}</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
