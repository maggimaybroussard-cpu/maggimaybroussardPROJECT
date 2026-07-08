'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useChat } from '@/lib/hooks/useChat';
import toast from 'react-hot-toast';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Deadline {
  date: string;
  description: string;
  urgent: boolean;
  daysUntil?: number;
}

interface ActionItem {
  item: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  dueDate: string | null;
  assignedTo?: string;
}

interface RetainerMilestone {
  milestone: string;
  status: 'pending' | 'approaching' | 'overdue' | 'completed';
  date: string | null;
  notes: string;
}

interface CaseAnalysis {
  caseTitle: string;
  clientName: string;
  matterType: string;
  documentType: string;
  summary: string;
  deadlines: Deadline[];
  actionItems: ActionItem[];
  retainerMilestones: RetainerMilestone[];
  opposingCounsel: Array<{ name: string; firm: string; contact: string }>;
  keyTerms: string[];
  estimatedHours: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  nextStepsSummary: string;
}

interface DraftedEmail {
  type: 'status_update' | 'milestone_alert' | 'next_steps';
  subject: string;
  body: string;
}

interface SavedAnalysis {
  id: string;
  fileName: string;
  analyzedAt: string;
  analysis: CaseAnalysis;
  draftedEmails: DraftedEmail[];
}

type DocTemplateType = 'retainer_agreement' | 'nda' | 'service_contract' | 'engagement_letter' | 'settlement_agreement';

interface GeneratedDocument {
  type: DocTemplateType;
  title: string;
  content: string;
  generatedAt: string;
}

interface DocGenFormData {
  clientName: string;
  clientAddress: string;
  clientEmail: string;
  matterType: string;
  matterDescription: string;
  feeAmount: string;
  feeStructure: string;
  startDate: string;
  jurisdiction: string;
  additionalTerms: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-50 text-red-700 border-red-200',
  high: 'bg-orange-50 text-orange-700 border-orange-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const PRIORITY_DOT: Record<string, string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-amber-500',
  low: 'bg-emerald-500',
};

const RISK_COLORS: Record<string, string> = {
  low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  high: 'bg-orange-50 text-orange-700 border-orange-200',
  critical: 'bg-red-50 text-red-700 border-red-200',
};

const MILESTONE_COLORS: Record<string, string> = {
  pending: 'bg-slate-50 text-slate-600 border-slate-200',
  approaching: 'bg-amber-50 text-amber-700 border-amber-200',
  overdue: 'bg-red-50 text-red-700 border-red-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const EMAIL_TYPE_LABELS: Record<string, string> = {
  status_update: '📧 Client Status Update',
  milestone_alert: '🔔 Retainer Milestone Alert',
  next_steps: '📋 Next Steps Summary',
};

const DOC_TEMPLATE_OPTIONS: Array<{ type: DocTemplateType; label: string; icon: string; description: string }> = [
  { type: 'retainer_agreement', label: 'Retainer Agreement', icon: '📋', description: 'Attorney-client retainer with fee structure and scope of representation' },
  { type: 'nda', label: 'Non-Disclosure Agreement', icon: '🔒', description: 'Mutual or one-way NDA protecting confidential information' },
  { type: 'service_contract', label: 'Service Contract', icon: '📝', description: 'General legal services contract with deliverables and payment terms' },
  { type: 'engagement_letter', label: 'Engagement Letter', icon: '✉️', description: 'Formal engagement letter confirming representation and terms' },
  { type: 'settlement_agreement', label: 'Settlement Agreement', icon: '⚖️', description: 'Settlement and release agreement for dispute resolution' },
];

const FEE_STRUCTURES = ['Flat Fee', 'Hourly Rate', 'Contingency', 'Retainer + Hourly', 'Monthly Retainer'];

function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${PRIORITY_COLORS[priority] ?? PRIORITY_COLORS.low}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[priority] ?? PRIORITY_DOT.low}`} />
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </span>
  );
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return 'TBD';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function getDaysUntil(dateStr: string): number | null {
  try {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

// ── System Prompts ─────────────────────────────────────────────────────────────

const ANALYSIS_SYSTEM_PROMPT = `You are a senior legal analyst AI for Broussard Legal Services. Analyze uploaded case files and retainer documents to extract critical information.

Return ONLY a valid JSON object with this EXACT structure (no markdown, no explanation):
{
  "caseTitle": "string",
  "clientName": "string",
  "matterType": "string (e.g. Business Formation, Contract Review, Employment, etc.)",
  "documentType": "string (e.g. Retainer Agreement, Case Summary, Motion, etc.)",
  "summary": "string (2-3 sentence executive summary)",
  "deadlines": [{"date": "YYYY-MM-DD or readable date", "description": "string", "urgent": boolean}],
  "actionItems": [{"item": "string", "priority": "urgent|high|medium|low", "dueDate": "YYYY-MM-DD or null", "assignedTo": "attorney|paralegal|client|string"}],
  "retainerMilestones": [{"milestone": "string", "status": "pending|approaching|overdue|completed", "date": "YYYY-MM-DD or null", "notes": "string"}],
  "opposingCounsel": [{"name": "string", "firm": "string", "contact": "string"}],
  "keyTerms": ["array of important legal terms, clauses, or conditions"],
  "estimatedHours": "string (e.g. '40-60 hours' or 'Not specified')",
  "riskLevel": "low|medium|high|critical",
  "nextStepsSummary": "string (3-5 bullet points as a single string, each on new line starting with •)"
}`;

const EMAIL_DRAFT_SYSTEM_PROMPT = `You are a professional legal communications specialist for Broussard Legal Services. Draft professional client emails based on case analysis data.

Return ONLY a valid JSON array with this EXACT structure (no markdown):
[
  {
    "type": "status_update",
    "subject": "string",
    "body": "string (professional email body with proper greeting, paragraphs, and closing)"
  },
  {
    "type": "milestone_alert",
    "subject": "string",
    "body": "string"
  },
  {
    "type": "next_steps",
    "subject": "string",
    "body": "string"
  }
]

Use a warm but professional tone. Sign as "Maggi May Broussard, Esq." Include specific dates and action items from the analysis. Keep each email concise (under 300 words).`;

function buildDocGenPrompt(docType: DocTemplateType, form: DocGenFormData, analysis: CaseAnalysis | null): string {
  const baseInfo = `
Client Name: ${form.clientName || (analysis?.clientName ?? 'CLIENT_NAME')}
Client Address: ${form.clientAddress || 'CLIENT_ADDRESS'}
Client Email: ${form.clientEmail || 'CLIENT_EMAIL'}
Matter Type: ${form.matterType || (analysis?.matterType ?? 'MATTER_TYPE')}
Matter Description: ${form.matterDescription || (analysis?.summary ?? 'MATTER_DESCRIPTION')}
Fee Amount: ${form.feeAmount || 'FEE_AMOUNT'}
Fee Structure: ${form.feeStructure || 'FEE_STRUCTURE'}
Start Date: ${form.startDate || 'START_DATE'}
Jurisdiction: ${form.jurisdiction || 'Louisiana'}
Additional Terms: ${form.additionalTerms || 'None'}
Attorney: Maggi May Broussard, Esq.
Firm: Broussard Legal Services
`;

  const prompts: Record<DocTemplateType, string> = {
    retainer_agreement: `Draft a professional Attorney-Client Retainer Agreement for Broussard Legal Services with the following details:
${baseInfo}
Include: scope of representation, fee structure, billing terms, client obligations, termination clause, confidentiality, governing law. Use formal legal language. Format with numbered sections and clear headings. Include signature blocks for both parties.`,

    nda: `Draft a comprehensive Non-Disclosure Agreement for Broussard Legal Services with the following details:
${baseInfo}
Include: definition of confidential information, obligations of receiving party, permitted disclosures, term and termination, remedies for breach, governing law. Format with numbered sections. Include signature blocks.`,

    service_contract: `Draft a Legal Services Contract for Broussard Legal Services with the following details:
${baseInfo}
Include: scope of services, deliverables, payment terms, timeline, intellectual property, limitation of liability, dispute resolution, termination. Format with numbered sections and clear headings. Include signature blocks.`,

    engagement_letter: `Draft a formal Attorney Engagement Letter for Broussard Legal Services with the following details:
${baseInfo}
Include: confirmation of representation, scope of services, fee arrangement, billing practices, client responsibilities, file retention policy, conflict of interest disclosure. Use professional letter format with date, address block, and signature.`,

    settlement_agreement: `Draft a Settlement and Release Agreement for Broussard Legal Services with the following details:
${baseInfo}
Include: recitals, settlement amount/terms, mutual release of claims, confidentiality of settlement, no admission of liability, governing law, entire agreement clause. Format with numbered sections. Include signature blocks for all parties.`,
  };

  return prompts[docType];
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function GeminiCaseAnalyzerDashboard() {
  const [inputMode, setInputMode] = useState<'file' | 'text'>('file');
  const [pastedText, setPastedText] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<CaseAnalysis | null>(null);
  const [draftedEmails, setDraftedEmails] = useState<DraftedEmail[]>([]);
  const [savedAnalyses, setSavedAnalyses] = useState<SavedAnalysis[]>([]);
  const [selectedSaved, setSelectedSaved] = useState<SavedAnalysis | null>(null);
  const [activeEmailIdx, setActiveEmailIdx] = useState(0);
  const [copiedEmail, setCopiedEmail] = useState<number | null>(null);
  const [isDrafting, setIsDrafting] = useState(false);
  const [activeSection, setActiveSection] = useState<'analyze' | 'history' | 'generate_docs'>('analyze');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Document generation state
  const [selectedDocType, setSelectedDocType] = useState<DocTemplateType>('retainer_agreement');
  const [docGenForm, setDocGenForm] = useState<DocGenFormData>({
    clientName: '', clientAddress: '', clientEmail: '', matterType: '',
    matterDescription: '', feeAmount: '', feeStructure: 'Flat Fee',
    startDate: '', jurisdiction: 'Louisiana', additionalTerms: '',
  });
  const [generatedDocs, setGeneratedDocs] = useState<GeneratedDocument[]>([]);
  const [activeGeneratedDocIdx, setActiveGeneratedDocIdx] = useState(0);
  const [copiedDoc, setCopiedDoc] = useState(false);

  const { response: analysisResponse, isLoading: isAnalyzing, error: analysisError, sendMessage: sendAnalysis } = useChat('GEMINI', 'gemini/gemini-2.5-flash', false);
  const { response: emailResponse, isLoading: isEmailDrafting, error: emailError, sendMessage: sendEmailDraft } = useChat('GEMINI', 'gemini/gemini-2.5-flash', false);
  const { response: docResponse, isLoading: isGeneratingDoc, error: docError, sendMessage: sendDocGen } = useChat('GEMINI', 'gemini/gemini-2.5-flash', false);

  useEffect(() => { if (analysisError) toast.error(analysisError.message); }, [analysisError]);
  useEffect(() => { if (emailError) toast.error(emailError.message); }, [emailError]);
  useEffect(() => { if (docError) toast.error(docError.message); }, [docError]);

  // Parse analysis response
  useEffect(() => {
    if (!analysisResponse || isAnalyzing) return;
    try {
      const cleaned = analysisResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed: CaseAnalysis = JSON.parse(cleaned);
      setAnalysis(parsed);
      // Auto-populate doc gen form from analysis
      setDocGenForm(prev => ({
        ...prev,
        clientName: parsed.clientName || prev.clientName,
        matterType: parsed.matterType || prev.matterType,
        matterDescription: parsed.summary || prev.matterDescription,
      }));
      toast.success('Case analysis complete!');
    } catch {
      toast.error('Failed to parse analysis. Please try again.');
    }
  }, [analysisResponse, isAnalyzing]);

  // Parse email draft response
  useEffect(() => {
    if (!emailResponse || isEmailDrafting) return;
    try {
      const cleaned = emailResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed: DraftedEmail[] = JSON.parse(cleaned);
      setDraftedEmails(parsed);
      setIsDrafting(false);
      toast.success('Email drafts ready!');
    } catch {
      setIsDrafting(false);
      toast.error('Failed to parse email drafts.');
    }
  }, [emailResponse, isEmailDrafting]);

  // Handle doc generation response
  useEffect(() => {
    if (!docResponse || isGeneratingDoc) return;
    const newDoc: GeneratedDocument = {
      type: selectedDocType,
      title: DOC_TEMPLATE_OPTIONS.find(d => d.type === selectedDocType)?.label ?? selectedDocType,
      content: docResponse,
      generatedAt: new Date().toISOString(),
    };
    setGeneratedDocs(prev => [newDoc, ...prev]);
    setActiveGeneratedDocIdx(0);
    toast.success('Document template generated!');
  }, [docResponse, isGeneratingDoc, selectedDocType]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validTypes = ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!validTypes.includes(file.type) && !file.name.endsWith('.txt') && !file.name.endsWith('.pdf')) {
      toast.error('Supported formats: PDF, TXT, DOC, DOCX');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File must be under 10 MB');
      return;
    }
    setUploadedFile(file);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => setFileBase64(reader.result as string);
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (inputMode === 'file' && !uploadedFile) { toast.error('Please upload a file first'); return; }
    if (inputMode === 'text' && !pastedText.trim()) { toast.error('Please paste document text first'); return; }
    setAnalysis(null);
    setDraftedEmails([]);
    if (inputMode === 'file' && fileBase64) {
      const isImage = uploadedFile?.type.startsWith('image/');
      const content: Array<{ type: string; text?: string; image_url?: { url: string }; file?: { file_data: string } }> = [
        { type: 'text', text: 'Analyze this legal document and extract all required information.' },
      ];
      if (isImage) {
        content.push({ type: 'image_url', image_url: { url: fileBase64 } });
      } else {
        content.push({ type: 'file', file: { file_data: fileBase64 } });
      }
      sendAnalysis([
        { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
        { role: 'user', content: content as unknown as string },
      ], { temperature: 0.1, max_tokens: 4000 });
    } else {
      sendAnalysis([
        { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
        { role: 'user', content: `Analyze this legal document:\n\n${pastedText}` },
      ], { temperature: 0.1, max_tokens: 4000 });
    }
  }, [inputMode, uploadedFile, fileBase64, pastedText, sendAnalysis]);

  const handleDraftEmails = useCallback(() => {
    if (!analysis) return;
    setIsDrafting(true);
    const context = JSON.stringify({
      clientName: analysis.clientName, caseTitle: analysis.caseTitle,
      matterType: analysis.matterType, summary: analysis.summary,
      deadlines: analysis.deadlines.slice(0, 3),
      actionItems: analysis.actionItems.filter(a => a.priority === 'urgent' || a.priority === 'high').slice(0, 5),
      retainerMilestones: analysis.retainerMilestones.slice(0, 3),
      nextStepsSummary: analysis.nextStepsSummary, riskLevel: analysis.riskLevel,
    });
    sendEmailDraft([
      { role: 'system', content: EMAIL_DRAFT_SYSTEM_PROMPT },
      { role: 'user', content: `Draft 3 professional emails based on this case analysis:\n\n${context}` },
    ], { temperature: 0.7, max_tokens: 3000 });
  }, [analysis, sendEmailDraft]);

  const handleGenerateDocument = useCallback(() => {
    if (!docGenForm.clientName.trim() && !analysis?.clientName) {
      toast.error('Please enter client name or analyze a document first');
      return;
    }
    const prompt = buildDocGenPrompt(selectedDocType, docGenForm, analysis);
    sendDocGen([
      { role: 'system', content: 'You are a senior legal document drafter for Broussard Legal Services. Generate complete, professional legal documents ready for attorney review. Use formal legal language and proper document structure.' },
      { role: 'user', content: prompt },
    ], { temperature: 0.3, max_tokens: 4000 });
  }, [selectedDocType, docGenForm, analysis, sendDocGen]);

  const handleSaveAnalysis = useCallback(() => {
    if (!analysis) return;
    const saved: SavedAnalysis = {
      id: Date.now().toString(),
      fileName: uploadedFile?.name ?? 'Pasted Document',
      analyzedAt: new Date().toISOString(),
      analysis, draftedEmails,
    };
    setSavedAnalyses(prev => [saved, ...prev.slice(0, 9)]);
    toast.success('Analysis saved!');
  }, [analysis, draftedEmails, uploadedFile]);

  const handleCopyEmail = useCallback((idx: number, body: string) => {
    navigator.clipboard.writeText(body).then(() => {
      setCopiedEmail(idx);
      setTimeout(() => setCopiedEmail(null), 2000);
    });
  }, []);

  const handleCopyDoc = useCallback((content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedDoc(true);
      setTimeout(() => setCopiedDoc(false), 2000);
    });
  }, []);

  const handleDownloadDoc = useCallback((doc: GeneratedDocument) => {
    const blob = new Blob([doc.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const urgentDeadlines = analysis?.deadlines.filter(d => d.urgent) ?? [];
  const urgentActions = analysis?.actionItems.filter(a => a.priority === 'urgent') ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(53,94,59,0.1)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
            </svg>
          </div>
          <div>
            <h2 className="font-serif text-xl text-foreground">Gemini Case File Analyzer</h2>
            <p className="text-xs text-muted-foreground">AI-powered analysis, document generation & email drafting</p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Gemini 2.5 Flash
          </span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['analyze', 'generate_docs', 'history'] as const).map(sec => (
            <button key={sec} onClick={() => setActiveSection(sec)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${activeSection === sec ? 'bg-foreground text-background' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
              {sec === 'analyze' ? 'Analyze' : sec === 'generate_docs' ? '📄 Generate Docs' : `History (${savedAnalyses.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* ── HISTORY TAB ── */}
      {activeSection === 'history' && (
        <div className="space-y-4">
          {savedAnalyses.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-12 text-center">
              <p className="text-muted-foreground text-sm">No saved analyses yet. Analyze a document to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {savedAnalyses.map(sa => (
                <button key={sa.id}
                  onClick={() => { setSelectedSaved(sa); setActiveSection('analyze'); setAnalysis(sa.analysis); setDraftedEmails(sa.draftedEmails); }}
                  className="bg-card border border-border rounded-2xl p-5 text-left hover:border-accent/40 transition-all">
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-semibold text-foreground text-sm truncate flex-1">{sa.analysis.caseTitle || sa.fileName}</p>
                    <span className={`ml-2 shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${RISK_COLORS[sa.analysis.riskLevel]}`}>{sa.analysis.riskLevel}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">{sa.analysis.clientName} · {sa.analysis.matterType}</p>
                  <p className="text-xs text-muted-foreground/60">{new Date(sa.analyzedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                  <div className="flex gap-2 mt-3">
                    <span className="text-xs bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full">{sa.analysis.deadlines.filter(d => d.urgent).length} urgent deadlines</span>
                    <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">{sa.analysis.actionItems.length} action items</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── GENERATE DOCS TAB ── */}
      {activeSection === 'generate_docs' && (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          {/* Left: Form */}
          <div className="xl:col-span-2 space-y-4">
            {/* Doc Type Selector */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border bg-secondary/30">
                <h3 className="text-sm font-semibold text-foreground">Document Type</h3>
              </div>
              <div className="p-4 space-y-2">
                {DOC_TEMPLATE_OPTIONS.map(opt => (
                  <button key={opt.type} onClick={() => setSelectedDocType(opt.type)}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${selectedDocType === opt.type ? 'border-emerald-400 bg-emerald-50/60' : 'border-border bg-secondary/20 hover:border-border/80'}`}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-base">{opt.icon}</span>
                      <span className={`text-sm font-semibold ${selectedDocType === opt.type ? 'text-emerald-800' : 'text-foreground'}`}>{opt.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground pl-6">{opt.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Client Info Form */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border bg-secondary/30 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Client & Matter Info</h3>
                {analysis && (
                  <button onClick={() => setDocGenForm(prev => ({
                    ...prev,
                    clientName: analysis.clientName || prev.clientName,
                    matterType: analysis.matterType || prev.matterType,
                    matterDescription: analysis.summary || prev.matterDescription,
                  }))}
                    className="text-xs text-emerald-700 font-semibold hover:underline">
                    ↑ Auto-fill from analysis
                  </button>
                )}
              </div>
              <div className="p-5 space-y-4">
                {[
                  { key: 'clientName', label: 'Client Full Name', placeholder: 'John Smith' },
                  { key: 'clientAddress', label: 'Client Address', placeholder: '123 Main St, New Orleans, LA 70112' },
                  { key: 'clientEmail', label: 'Client Email', placeholder: 'client@email.com' },
                  { key: 'matterType', label: 'Matter Type', placeholder: 'Business Formation, Contract Review…' },
                  { key: 'feeAmount', label: 'Fee Amount', placeholder: '$5,000 flat fee / $350/hr' },
                  { key: 'startDate', label: 'Engagement Start Date', placeholder: '' },
                  { key: 'jurisdiction', label: 'Jurisdiction', placeholder: 'Louisiana' },
                ].map(field => (
                  <div key={field.key}>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">{field.label}</label>
                    <input
                      type={field.key === 'startDate' ? 'date' : 'text'}
                      value={docGenForm[field.key as keyof DocGenFormData]}
                      onChange={e => setDocGenForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40"
                    />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Fee Structure</label>
                  <select value={docGenForm.feeStructure} onChange={e => setDocGenForm(prev => ({ ...prev, feeStructure: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40">
                    {FEE_STRUCTURES.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Matter Description</label>
                  <textarea rows={3} value={docGenForm.matterDescription}
                    onChange={e => setDocGenForm(prev => ({ ...prev, matterDescription: e.target.value }))}
                    placeholder="Brief description of the legal matter…"
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 resize-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Additional Terms / Notes</label>
                  <textarea rows={2} value={docGenForm.additionalTerms}
                    onChange={e => setDocGenForm(prev => ({ ...prev, additionalTerms: e.target.value }))}
                    placeholder="Any special terms, clauses, or conditions to include…"
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 resize-none" />
                </div>
              </div>
            </div>

            <button onClick={handleGenerateDocument} disabled={isGeneratingDoc}
              className="w-full py-3.5 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: '#355E3B', color: '#fff' }}>
              {isGeneratingDoc ? (
                <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Generating Document…</>
              ) : (
                <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>Generate {DOC_TEMPLATE_OPTIONS.find(d => d.type === selectedDocType)?.label}</>
              )}
            </button>
          </div>

          {/* Right: Generated Document */}
          <div className="xl:col-span-3 space-y-4">
            {generatedDocs.length === 0 && !isGeneratingDoc && (
              <div className="bg-card border border-border rounded-2xl p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-secondary/60 flex items-center justify-center mx-auto mb-4">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                  </svg>
                </div>
                <p className="text-sm font-medium text-foreground mb-1">Select a document type and fill in client info</p>
                <p className="text-xs text-muted-foreground">Gemini will generate a complete legal document template ready for attorney review</p>
                {analysis && (
                  <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700">
                    ✓ Case analysis loaded — client info will be auto-populated
                  </div>
                )}
              </div>
            )}

            {isGeneratingDoc && (
              <div className="bg-card border border-border rounded-2xl p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4 animate-pulse">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                  </svg>
                </div>
                <p className="text-sm font-semibold text-foreground mb-1">Generating {DOC_TEMPLATE_OPTIONS.find(d => d.type === selectedDocType)?.label}…</p>
                <p className="text-xs text-muted-foreground">Drafting complete legal document with all required clauses</p>
              </div>
            )}

            {generatedDocs.length > 0 && (
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                {/* Doc tabs */}
                {generatedDocs.length > 1 && (
                  <div className="flex border-b border-border overflow-x-auto">
                    {generatedDocs.map((doc, i) => (
                      <button key={i} onClick={() => setActiveGeneratedDocIdx(i)}
                        className={`shrink-0 px-4 py-2.5 text-xs font-semibold transition-all ${activeGeneratedDocIdx === i ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}>
                        {doc.title}
                      </button>
                    ))}
                  </div>
                )}
                {generatedDocs[activeGeneratedDocIdx] && (
                  <>
                    <div className="px-5 py-3.5 border-b border-border bg-secondary/30 flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">{generatedDocs[activeGeneratedDocIdx].title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">Generated {new Date(generatedDocs[activeGeneratedDocIdx].generatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleCopyDoc(generatedDocs[activeGeneratedDocIdx].content)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-xs font-semibold text-foreground hover:bg-secondary/80 transition-all">
                          {copiedDoc ? '✓ Copied' : '📋 Copy'}
                        </button>
                        <button onClick={() => handleDownloadDoc(generatedDocs[activeGeneratedDocIdx])}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90"
                          style={{ background: '#355E3B' }}>
                          ⬇ Download
                        </button>
                      </div>
                    </div>
                    <div className="p-5">
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-start gap-2">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                        <p className="text-xs text-amber-700">This is an AI-generated draft for attorney review only. Not for direct client use without review and modification by a licensed attorney.</p>
                      </div>
                      <div className="bg-secondary/20 rounded-xl p-5 border border-border max-h-[600px] overflow-y-auto">
                        <pre className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap font-sans">{generatedDocs[activeGeneratedDocIdx].content}</pre>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ANALYZE TAB ── */}
      {activeSection === 'analyze' && (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          {/* Left: Upload Panel */}
          <div className="xl:col-span-2 space-y-4">
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="flex border-b border-border">
                <button onClick={() => setInputMode('file')}
                  className={`flex-1 py-3 text-xs font-semibold uppercase tracking-widest transition-all ${inputMode === 'file' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}>
                  Upload File
                </button>
                <button onClick={() => setInputMode('text')}
                  className={`flex-1 py-3 text-xs font-semibold uppercase tracking-widest transition-all ${inputMode === 'text' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}>
                  Paste Text
                </button>
              </div>
              <div className="p-5">
                {inputMode === 'file' ? (
                  <div>
                    <input ref={fileInputRef} type="file" accept=".pdf,.txt,.doc,.docx" className="hidden" onChange={handleFileChange} />
                    <button onClick={() => fileInputRef.current?.click()}
                      className="w-full border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-accent/50 transition-all group">
                      <div className="w-12 h-12 rounded-xl bg-secondary/60 flex items-center justify-center mx-auto mb-3 group-hover:bg-accent/10 transition-all">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                      </div>
                      {uploadedFile ? (
                        <div>
                          <p className="text-sm font-semibold text-foreground">{uploadedFile.name}</p>
                          <p className="text-xs text-muted-foreground mt-1">{(uploadedFile.size / 1024).toFixed(1)} KB · Click to change</p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm font-medium text-foreground">Drop file or click to upload</p>
                          <p className="text-xs text-muted-foreground mt-1">PDF, TXT, DOC, DOCX · Max 10 MB</p>
                        </div>
                      )}
                    </button>
                  </div>
                ) : (
                  <textarea value={pastedText} onChange={e => setPastedText(e.target.value)}
                    placeholder="Paste retainer agreement, case summary, or legal document text here…"
                    rows={10}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 resize-none" />
                )}
              </div>
            </div>

            <button onClick={handleAnalyze}
              disabled={isAnalyzing || (inputMode === 'file' && !uploadedFile) || (inputMode === 'text' && !pastedText.trim())}
              className="w-full py-3.5 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: '#355E3B', color: '#fff' }}>
              {isAnalyzing ? (
                <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Analyzing with Gemini…</>
              ) : (
                <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>Analyze Document</>
              )}
            </button>

            {(urgentDeadlines.length > 0 || urgentActions.length > 0) && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <p className="text-xs font-bold text-red-700 uppercase tracking-widest">Urgent Attention Required</p>
                </div>
                {urgentDeadlines.map((d, i) => (
                  <div key={i} className="flex items-start gap-2 mb-2 last:mb-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                    <p className="text-xs text-red-700">{d.description} — <span className="font-semibold">{formatDate(d.date)}</span></p>
                  </div>
                ))}
                {urgentActions.map((a, i) => (
                  <div key={i} className="flex items-start gap-2 mb-2 last:mb-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                    <p className="text-xs text-red-700">{a.item}</p>
                  </div>
                ))}
              </div>
            )}

            {analysis && (
              <button onClick={() => setActiveSection('generate_docs')}
                className="w-full py-3 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all flex items-center justify-center gap-2 border-2"
                style={{ borderColor: '#355E3B', color: '#355E3B', background: 'rgba(53,94,59,0.05)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                Generate Document from This Analysis
              </button>
            )}
          </div>

          {/* Right: Analysis Results */}
          <div className="xl:col-span-3 space-y-4">
            {!analysis && !isAnalyzing && (
              <div className="bg-card border border-border rounded-2xl p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-secondary/60 flex items-center justify-center mx-auto mb-4">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                  </svg>
                </div>
                <p className="text-sm font-medium text-foreground mb-1">Upload a case file or retainer doc</p>
                <p className="text-xs text-muted-foreground">Gemini will surface deadlines, action items, and draft client emails</p>
              </div>
            )}

            {isAnalyzing && (
              <div className="bg-card border border-border rounded-2xl p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4 animate-pulse">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                  </svg>
                </div>
                <p className="text-sm font-semibold text-foreground mb-1">Gemini is analyzing your document…</p>
                <p className="text-xs text-muted-foreground">Extracting deadlines, action items, and key terms</p>
              </div>
            )}

            {analysis && (
              <>
                {/* Case Overview */}
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-border bg-secondary/30 flex items-center justify-between">
                    <div>
                      <h3 className="font-serif text-lg text-foreground">{analysis.caseTitle || 'Case Analysis'}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{analysis.clientName} · {analysis.matterType}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${RISK_COLORS[analysis.riskLevel]}`}>
                        Risk: {analysis.riskLevel.charAt(0).toUpperCase() + analysis.riskLevel.slice(1)}
                      </span>
                      <button onClick={handleSaveAnalysis} className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-all" title="Save analysis">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="p-5">
                    <p className="text-sm text-foreground/80 leading-relaxed mb-4">{analysis.summary}</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-secondary/40 rounded-xl p-3">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Document Type</p>
                        <p className="text-sm font-medium text-foreground">{analysis.documentType}</p>
                      </div>
                      <div className="bg-secondary/40 rounded-xl p-3">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Est. Hours</p>
                        <p className="text-sm font-medium text-foreground">{analysis.estimatedHours}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Deadlines */}
                {analysis.deadlines.length > 0 && (
                  <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-border bg-secondary/30 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        <h4 className="text-sm font-semibold text-foreground">Upcoming Deadlines</h4>
                      </div>
                      <span className="text-xs text-muted-foreground bg-white border border-border rounded-full px-2 py-0.5">{analysis.deadlines.length}</span>
                    </div>
                    <div className="divide-y divide-border">
                      {analysis.deadlines.map((d, i) => {
                        const days = getDaysUntil(d.date);
                        return (
                          <div key={i} className={`px-5 py-3.5 flex items-start justify-between gap-3 ${d.urgent ? 'bg-red-50/50' : ''}`}>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-foreground font-medium">{d.description}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{formatDate(d.date)}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {days !== null && (
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${days < 0 ? 'bg-red-100 text-red-700' : days <= 7 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                                  {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today' : `${days}d`}
                                </span>
                              )}
                              {d.urgent && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">Urgent</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Action Items */}
                {analysis.actionItems.length > 0 && (
                  <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-border bg-secondary/30 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                        <h4 className="text-sm font-semibold text-foreground">Action Items</h4>
                      </div>
                      <span className="text-xs text-muted-foreground bg-white border border-border rounded-full px-2 py-0.5">{analysis.actionItems.length}</span>
                    </div>
                    <div className="divide-y divide-border">
                      {analysis.actionItems.map((a, i) => (
                        <div key={i} className="px-5 py-3.5 flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground">{a.item}</p>
                            {a.assignedTo && <p className="text-xs text-muted-foreground mt-0.5">→ {a.assignedTo}</p>}
                            {a.dueDate && <p className="text-xs text-muted-foreground mt-0.5">{formatDate(a.dueDate)}</p>}
                          </div>
                          <PriorityBadge priority={a.priority} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Retainer Milestones */}
                {analysis.retainerMilestones.length > 0 && (
                  <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-border bg-secondary/30">
                      <div className="flex items-center gap-2">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                        <h4 className="text-sm font-semibold text-foreground">Retainer Milestones</h4>
                      </div>
                    </div>
                    <div className="divide-y divide-border">
                      {analysis.retainerMilestones.map((m, i) => (
                        <div key={i} className="px-5 py-3.5 flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground font-medium">{m.milestone}</p>
                            {m.notes && <p className="text-xs text-muted-foreground mt-0.5">{m.notes}</p>}
                            {m.date && <p className="text-xs text-muted-foreground mt-0.5">{formatDate(m.date)}</p>}
                          </div>
                          <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${MILESTONE_COLORS[m.status]}`}>
                            {m.status.charAt(0).toUpperCase() + m.status.slice(1)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Next Steps */}
                {analysis.nextStepsSummary && (
                  <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-border bg-secondary/30">
                      <h4 className="text-sm font-semibold text-foreground">Next Steps Summary</h4>
                    </div>
                    <div className="p-5 space-y-2">
                      {analysis.nextStepsSummary.split('\n').filter(l => l.trim()).map((line, i) => (
                        <p key={i} className="text-sm text-foreground/80 leading-relaxed">{line}</p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Draft Emails Button */}
                <button onClick={handleDraftEmails} disabled={isEmailDrafting || isDrafting}
                  className="w-full py-3.5 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2 border-2"
                  style={{ borderColor: '#355E3B', color: '#355E3B', background: 'rgba(53,94,59,0.05)' }}>
                  {isEmailDrafting || isDrafting ? (
                    <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Drafting Emails…</>
                  ) : (
                    <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>Auto-Draft Client Emails</>
                  )}
                </button>

                {/* Drafted Emails */}
                {draftedEmails.length > 0 && (
                  <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-border bg-secondary/30">
                      <h4 className="text-sm font-semibold text-foreground">Auto-Drafted Client Emails</h4>
                    </div>
                    <div className="flex border-b border-border">
                      {draftedEmails.map((email, i) => (
                        <button key={i} onClick={() => setActiveEmailIdx(i)}
                          className={`flex-1 py-2.5 text-xs font-semibold transition-all ${activeEmailIdx === i ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}>
                          {EMAIL_TYPE_LABELS[email.type] ?? email.type}
                        </button>
                      ))}
                    </div>
                    {draftedEmails[activeEmailIdx] && (
                      <div className="p-5">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Subject</p>
                          <button onClick={() => handleCopyEmail(activeEmailIdx, `Subject: ${draftedEmails[activeEmailIdx].subject}\n\n${draftedEmails[activeEmailIdx].body}`)}
                            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                            {copiedEmail === activeEmailIdx ? (
                              <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Copied!</>
                            ) : (
                              <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy</>
                            )}
                          </button>
                        </div>
                        <p className="text-sm font-semibold text-foreground mb-4 p-3 bg-secondary/40 rounded-xl">{draftedEmails[activeEmailIdx].subject}</p>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Body</p>
                        <div className="bg-secondary/20 rounded-xl p-4 border border-border">
                          <pre className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap font-sans">{draftedEmails[activeEmailIdx].body}</pre>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
