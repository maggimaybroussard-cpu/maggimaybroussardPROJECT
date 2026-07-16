'use client';

import React, { useState, useEffect, useRef } from 'react';
import { getChatCompletion } from '@/lib/ai/chatCompletion';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

// ── Types ─────────────────────────────────────────────────────────────────────

type DocumentType =
  | 'motion' | 'brief' | 'discovery_request' | 'demand_letter' | 'settlement_agreement' | 'contract_review';

type DraftStep = 'configure' | 'drafting' | 'review' | 'saved';

type PageSize = 'letter' | 'legal';

type WatermarkType = 'none' | 'bl_logo' | 'draft' | 'confidential' | 'attorney_client' | 'privileged';

type EmbedFormat = 'print' | 'html' | 'rtf' | 'txt';

interface DocumentDraftForm {
  documentType: DocumentType;
  title: string;
  clientName: string;
  clientEmail: string;
  caseRef: string;
  serviceType: string;
  caseFacts: string;
  customInstructions: string;
  pageSize: PageSize;
  watermark: WatermarkType;
  includeHeader: boolean;
  includeFooter: boolean;
  headerText: string;
  footerText: string;
  embedFormat: EmbedFormat;
}

interface LexiDocumentDrafterProps {
  onClose: () => void;
  prefillClientName?: string;
  prefillCaseRef?: string;
}

// ── Asset Paths ───────────────────────────────────────────────────────────────

const BROUSSARD_LOGO = '/assets/images/Broussardlogo-1781834380907.png';
const BL_MONOGRAM   = '/assets/images/initiallogo-1781834347231.png';
const FOOTER_IMAGE  = '/assets/images/footer-1781834391454.png';

// ── Constants ─────────────────────────────────────────────────────────────────

const DOCUMENT_TYPES: Array<{
  id: DocumentType;
  label: string;
  icon: string;
  description: string;
}> = [
  { id: 'motion', label: 'Motion', icon: '⚖️', description: 'Motion to compel, dismiss, or for summary judgment' },
  { id: 'brief', label: 'Legal Brief', icon: '📄', description: 'Memorandum of law or appellate brief' },
  { id: 'discovery_request', label: 'Discovery Request', icon: '🔍', description: 'Interrogatories, requests for production, or admissions' },
  { id: 'demand_letter', label: 'Demand Letter', icon: '✉️', description: 'Pre-litigation demand or cease-and-desist letter' },
  { id: 'settlement_agreement', label: 'Settlement Agreement', icon: '🤝', description: 'Draft settlement terms and release language' },
  { id: 'contract_review', label: 'Contract Review Memo', icon: '📋', description: 'Summary of key terms, risks, and recommendations' },
];

const SERVICE_TYPES = [
  'Business Law',
  'Employment Law',
  'Real Estate',
  'Estate Planning',
  'Litigation',
  'Contract Dispute',
  'Legal Research',
  'Other',
];

const PAGE_SIZES: Array<{ id: PageSize; label: string; dimensions: string; cssWidth: string; cssHeight: string }> = [
  { id: 'letter', label: 'Letter (8.5" × 11")', dimensions: '8.5 × 11 in', cssWidth: '8.5in', cssHeight: '11in' },
  { id: 'legal', label: 'Legal (8.5" × 14")', dimensions: '8.5 × 14 in', cssWidth: '8.5in', cssHeight: '14in' },
];

const WATERMARK_OPTIONS: Array<{ id: WatermarkType; label: string; text: string; isImage?: boolean }> = [
  { id: 'none',            label: 'No Watermark',                  text: '' },
  { id: 'bl_logo',         label: 'BL Monogram (Broussard)',        text: '', isImage: true },
  { id: 'draft',           label: 'DRAFT',                         text: 'DRAFT' },
  { id: 'confidential',    label: 'CONFIDENTIAL',                  text: 'CONFIDENTIAL' },
  { id: 'attorney_client', label: 'ATTORNEY-CLIENT PRIVILEGED',    text: 'ATTORNEY-CLIENT PRIVILEGED' },
  { id: 'privileged',      label: 'PRIVILEGED & CONFIDENTIAL',     text: 'PRIVILEGED & CONFIDENTIAL' },
];

const EMBED_FORMATS: Array<{ id: EmbedFormat; label: string; icon: string; description: string }> = [
  { id: 'print', label: 'Print / PDF',  icon: '🖨️', description: 'Formatted print window with full branding' },
  { id: 'html',  label: 'HTML Embed',   icon: '🌐', description: 'Embeddable HTML with inline styles' },
  { id: 'rtf',   label: 'RTF Format',   icon: '📝', description: 'Rich Text Format for Word/LibreOffice' },
  { id: 'txt',   label: 'Plain Text',   icon: '📄', description: 'Clean .txt download' },
];

// ── Legal Symbols for Quick-Insert ────────────────────────────────────────────

const QUICK_SYMBOLS: Array<{ symbol: string; name: string }> = [
  { symbol: '§',   name: 'Section' },
  { symbol: '§§',  name: 'Sections' },
  { symbol: '¶',   name: 'Paragraph' },
  { symbol: '©',   name: 'Copyright' },
  { symbol: '®',   name: 'Registered' },
  { symbol: '™',   name: 'Trademark' },
  { symbol: '℠',   name: 'Service Mark' },
  { symbol: '†',   name: 'Dagger' },
  { symbol: '‡',   name: 'Double Dagger' },
  { symbol: '°',   name: 'Degree' },
  { symbol: '±',   name: 'Plus/Minus' },
  { symbol: '≤',   name: 'Less/Equal' },
  { symbol: '≥',   name: 'Greater/Equal' },
  { symbol: '≠',   name: 'Not Equal' },
  { symbol: '…',   name: 'Ellipsis' },
  { symbol: '—',   name: 'Em Dash' },
  { symbol: '–',   name: 'En Dash' },
  { symbol: '«',   name: 'Left Guillemet' },
  { symbol: '»',   name: 'Right Guillemet' },
  { symbol: '″',   name: 'Double Prime' },
  { symbol: '′',   name: 'Prime' },
  { symbol: '№',   name: 'Numero' },
  { symbol: '¢',   name: 'Cent' },
  { symbol: '£',   name: 'Pound' },
  { symbol: '€',   name: 'Euro' },
  { symbol: '¥',   name: 'Yen' },
  { symbol: 'et al.',   name: 'Et al.' },
  { symbol: 'i.e.,',   name: 'i.e.' },
  { symbol: 'e.g.,',   name: 'e.g.' },
  { symbol: 'id.',      name: 'Id.' },
  { symbol: 'supra',    name: 'Supra' },
  { symbol: 'infra',    name: 'Infra' },
  { symbol: 'ibid.',    name: 'Ibid.' },
  { symbol: 'cf.',      name: 'Cf.' },
  { symbol: 'v.',       name: 'Versus (v.)' },
];

// ── Prompt Builder ────────────────────────────────────────────────────────────

function buildDocumentPrompt(form: DocumentDraftForm): string {
  const docLabel = DOCUMENT_TYPES.find(d => d.id === form.documentType)?.label ?? form.documentType;
  return `You are Lexi, a highly experienced legal secretary at Broussard Legal Services, a boutique law firm in Louisiana specializing in business law, contracts, employment law, real estate, estate planning, and litigation support.

Draft a professional ${docLabel} for the following matter. Use proper legal formatting, Louisiana law conventions where applicable, and formal legal language throughout.

MATTER DETAILS:
- Document Type: ${docLabel}
- Client: ${form.clientName}${form.caseRef ? ` | Matter/Case: ${form.caseRef}` : ''}${form.serviceType ? ` | Service Area: ${form.serviceType}` : ''}
- Page Size: ${form.pageSize === 'legal' ? 'Legal (8.5" × 14")' : 'Letter (8.5" × 11")'}

CASE FACTS AND CONTEXT:
${form.caseFacts}
${form.customInstructions ? `\nSPECIAL INSTRUCTIONS:\n${form.customInstructions}` : ''}

DRAFTING REQUIREMENTS:
1. Use proper legal document structure with clear headings and numbered sections
2. Include all standard components for a ${docLabel} (caption, introduction, argument/body, conclusion/prayer for relief as applicable)
3. Use formal legal language appropriate for Louisiana courts or business practice
4. Insert [PLACEHOLDER] markers where specific dates, amounts, or case-specific details need to be filled in
5. Include a "PREPARED BY: Lexi (AI Draft — Attorney Review Required)" footer note
6. Keep the draft comprehensive but focused on the facts provided
7. Format for Times New Roman 12pt font, double-spaced where appropriate for court documents

Begin the draft now:`;
}

// ── Print Styles Builder ──────────────────────────────────────────────────────

function buildPrintStyles(form: DocumentDraftForm): string {
  const pageSize = PAGE_SIZES.find(p => p.id === form.pageSize)!;
  const watermarkOption = WATERMARK_OPTIONS.find(w => w.id === form.watermark)!;

  return `
    @page {
      size: ${pageSize.cssWidth} ${pageSize.cssHeight};
      margin: 1in 1.25in 1in 1.25in;
    }
    * { box-sizing: border-box; }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 12pt;
      color: #000000;
      line-height: 2;
      background: white;
      margin: 0;
      padding: 0;
    }
    .doc-wrapper {
      font-family: 'Times New Roman', Times, serif;
      font-size: 12pt;
      color: #000000;
      line-height: 2;
      position: relative;
      min-height: 100vh;
    }
    .doc-header {
      text-align: center;
      border-bottom: 2px solid #000;
      padding-bottom: 10pt;
      margin-bottom: 18pt;
    }
    .doc-header img.header-logo {
      max-width: 340px;
      width: 100%;
      height: auto;
      display: block;
      margin: 0 auto 6pt auto;
    }
    .doc-header-sub {
      font-size: 9pt;
      color: #333;
      letter-spacing: 0.04em;
    }
    .doc-footer {
      border-top: 1px solid #000;
      padding-top: 6pt;
      margin-top: 18pt;
      text-align: center;
    }
    .doc-footer img.footer-img {
      max-width: 320px;
      width: 100%;
      height: auto;
      display: block;
      margin: 0 auto 4pt auto;
    }
    .doc-footer-sub {
      font-size: 8pt;
      color: #555;
    }
    .doc-content {
      white-space: pre-wrap;
      font-family: 'Times New Roman', Times, serif;
      font-size: 12pt;
      color: #000000;
      position: relative;
      z-index: 1;
    }
    ${watermarkOption.isImage ? `
    .watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 340px;
      height: auto;
      opacity: 0.07;
      pointer-events: none;
      z-index: 0;
    }
    ` : watermarkOption.text ? `
    .watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-45deg);
      font-size: 72pt;
      font-family: 'Times New Roman', Times, serif;
      color: rgba(0, 0, 0, 0.08);
      font-weight: bold;
      white-space: nowrap;
      pointer-events: none;
      z-index: 0;
      letter-spacing: 0.1em;
    }
    ` : ''}
    @media print {
      .no-print { display: none !important; }
    }
  `;
}

// ── Print Document Builder ────────────────────────────────────────────────────

function buildPrintDocument(form: DocumentDraftForm, content: string): string {
  const watermarkOption = WATERMARK_OPTIONS.find(w => w.id === form.watermark)!;
  const styles = buildPrintStyles(form);
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const headerHtml = form.includeHeader
    ? `<div class="doc-header">
        <img class="header-logo" src="${baseUrl}${BROUSSARD_LOGO}" alt="Broussard Legal Services" />
        <div class="doc-header-sub">${form.headerText || `${form.clientName}${form.caseRef ? ` &nbsp;·&nbsp; ${form.caseRef}` : ''} &nbsp;·&nbsp; broussardlegalservices.com`}</div>
      </div>`
    : '';

  const footerHtml = form.includeFooter
    ? `<div class="doc-footer">
        <img class="footer-img" src="${baseUrl}${FOOTER_IMAGE}" alt="Professional. Precise. Client-Focused." />
        <div class="doc-footer-sub">${form.footerText || `Broussard Legal Services &nbsp;·&nbsp; Louisiana &amp; Nationwide &nbsp;·&nbsp; broussardlegalservices.com`}</div>
      </div>`
    : '';

  const watermarkHtml = watermarkOption.isImage
    ? `<img class="watermark" src="${baseUrl}${BL_MONOGRAM}" alt="BL Watermark" />`
    : watermarkOption.text
    ? `<div class="watermark">${watermarkOption.text}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${form.title || 'Legal Document'}</title>
  <style>${styles}</style>
</head>
<body>
  <div class="doc-wrapper">
    ${watermarkHtml}
    ${headerHtml}
    <div class="doc-content">${content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
    ${footerHtml}
  </div>
</body>
</html>`;
}

// ── HTML Embed Builder ────────────────────────────────────────────────────────

function buildHtmlEmbed(form: DocumentDraftForm, content: string): string {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const watermarkOption = WATERMARK_OPTIONS.find(w => w.id === form.watermark)!;

  const watermarkStyle = watermarkOption.isImage
    ? `position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:300px;opacity:0.07;pointer-events:none;z-index:0;`
    : watermarkOption.text
    ? `position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);font-size:64pt;font-family:'Times New Roman',serif;color:rgba(0,0,0,0.07);font-weight:bold;white-space:nowrap;pointer-events:none;z-index:0;`
    : '';

  const watermarkHtml = watermarkOption.isImage
    ? `<img style="${watermarkStyle}" src="${baseUrl}${BL_MONOGRAM}" alt="" />`
    : watermarkOption.text
    ? `<div style="${watermarkStyle}">${watermarkOption.text}</div>`
    : '';

  const headerHtml = form.includeHeader
    ? `<div style="text-align:center;border-bottom:2px solid #000;padding-bottom:10pt;margin-bottom:18pt;">
        <img src="${baseUrl}${BROUSSARD_LOGO}" alt="Broussard Legal Services" style="max-width:320px;width:100%;height:auto;display:block;margin:0 auto 6pt auto;" />
        <div style="font-size:9pt;color:#333;">${form.headerText || `${form.clientName}${form.caseRef ? ` · ${form.caseRef}` : ''} · broussardlegalservices.com`}</div>
      </div>`
    : '';

  const footerHtml = form.includeFooter
    ? `<div style="border-top:1px solid #000;padding-top:6pt;margin-top:18pt;text-align:center;">
        <img src="${baseUrl}${FOOTER_IMAGE}" alt="Professional. Precise. Client-Focused." style="max-width:300px;width:100%;height:auto;display:block;margin:0 auto 4pt auto;" />
        <div style="font-size:8pt;color:#555;">${form.footerText || `Broussard Legal Services · Louisiana &amp; Nationwide · broussardlegalservices.com`}</div>
      </div>`
    : '';

  const escapedContent = content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return `<!-- Broussard Legal Services — Embedded Document -->
<div style="font-family:'Times New Roman',Times,serif;font-size:12pt;color:#000;line-height:2;max-width:8.5in;margin:0 auto;padding:1in 1.25in;background:#fff;position:relative;">
  ${watermarkHtml}
  ${headerHtml}
  <div style="white-space:pre-wrap;font-family:'Times New Roman',Times,serif;font-size:12pt;color:#000;position:relative;z-index:1;">${escapedContent}</div>
  ${footerHtml}
</div>`;
}

// ── RTF Builder ───────────────────────────────────────────────────────────────

function buildRtfDocument(form: DocumentDraftForm, content: string): string {
  const headerLine = form.includeHeader
    ? `BROUSSARD LEGAL SERVICES\\line ${form.headerText || `${form.clientName}${form.caseRef ? ` | ${form.caseRef}` : ''} | broussardlegalservices.com`}\\line\\line`
    : '';
  const footerLine = form.includeFooter
    ? `\\line\\line ${form.footerText || 'Broussard Legal Services | Professional. Precise. Client-Focused. | broussardlegalservices.com'}`
    : '';
  const watermarkOption = WATERMARK_OPTIONS.find(w => w.id === form.watermark)!;
  const watermarkLine = watermarkOption.text ? `[${watermarkOption.text}]\\line\\line` : '';

  const rtfContent = content
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\par\n')
    .replace(/[^\x00-\x7F]/g, c => `\\u${c.charCodeAt(0)}?`);

  return `{\\rtf1\\ansi\\deff0
{\\fonttbl{\\f0\\froman\\fcharset0 Times New Roman;}}
{\\colortbl;\\red0\\green0\\blue0;}
\\paperw${form.pageSize === 'legal' ? '12240' : '12240'}\\paperh${form.pageSize === 'legal' ? '20160' : '15840'}
\\margl1440\\margr1440\\margt1440\\margb1440
\\f0\\fs24\\cf1
${watermarkLine}${headerLine}${rtfContent}${footerLine}
}`;
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function LexiDocumentDrafter({
  onClose,
  prefillClientName = '',
  prefillCaseRef = '',
}: LexiDocumentDrafterProps) {
  const supabase = createClient();
  const [step, setStep] = useState<DraftStep>('configure');
  const [isDrafting, setIsDrafting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draftContent, setDraftContent] = useState('');
  const [savedDraftId, setSavedDraftId] = useState<string | null>(null);
  const [showSymbolPanel, setShowSymbolPanel] = useState(false);
  const draftTextareaRef = useRef<HTMLTextAreaElement>(null);

  const [form, setForm] = useState<DocumentDraftForm>({
    documentType: 'motion',
    title: '',
    clientName: prefillClientName,
    clientEmail: '',
    caseRef: prefillCaseRef,
    serviceType: '',
    caseFacts: '',
    customInstructions: '',
    pageSize: 'letter',
    watermark: 'bl_logo',
    includeHeader: true,
    includeFooter: true,
    headerText: '',
    footerText: '',
    embedFormat: 'print',
  });

  const selectedDocType = DOCUMENT_TYPES.find(d => d.id === form.documentType)!;

  const updateForm = (field: keyof DocumentDraftForm, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  // ── Insert symbol at cursor in draft textarea ──────────────────────────────
  const insertSymbol = (symbol: string) => {
    const textarea = draftTextareaRef.current;
    if (!textarea) {
      setDraftContent(prev => prev + symbol);
      toast.success(`Inserted: ${symbol}`);
      return;
    }
    const start = textarea.selectionStart ?? draftContent.length;
    const end = textarea.selectionEnd ?? draftContent.length;
    const newContent = draftContent.slice(0, start) + symbol + draftContent.slice(end);
    setDraftContent(newContent);
    // Restore cursor position after React re-render
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + symbol.length, start + symbol.length);
    }, 0);
    toast.success(`Inserted: ${symbol}`, { duration: 1000 });
  };

  const handleDraft = async () => {
    if (!form.clientName.trim()) {
      toast.error('Client name is required');
      return;
    }
    if (!form.caseFacts.trim()) {
      toast.error('Case facts are required to generate a draft');
      return;
    }
    if (!form.title.trim()) {
      toast.error('Please provide a document title');
      return;
    }

    setIsDrafting(true);
    setStep('drafting');
    setDraftContent('');

    try {
      const result = await getChatCompletion(
        'OPEN_AI',
        'gpt-4o-mini',
        [
          {
            role: 'system',
            content:
              'You are Lexi, a professional legal secretary at Broussard Legal Services. Draft legal documents with precision, proper formatting, and formal legal language. Always include [PLACEHOLDER] markers for case-specific details that need attorney review.',
          },
          { role: 'user', content: buildDocumentPrompt(form) },
        ],
        { max_completion_tokens: 3000 }
      );

      const content = result?.choices?.[0]?.message?.content ?? '';
      if (!content) throw new Error('No draft generated');
      setDraftContent(content);
      setStep('review');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate draft');
      setStep('configure');
    } finally {
      setIsDrafting(false);
    }
  };

  const handleSaveForReview = async () => {
    if (!draftContent) return;
    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('lexi_document_drafts')
        .insert({
          document_type: form.documentType,
          title: form.title,
          client_name: form.clientName,
          client_email: form.clientEmail || null,
          case_ref: form.caseRef || null,
          service_type: form.serviceType || null,
          case_facts: form.caseFacts,
          custom_instructions: form.customInstructions || null,
          draft_content: draftContent,
          draft_status: 'pending_review',
        })
        .select()
        .single();

      if (error) throw error;
      setSavedDraftId(data.id);
      setStep('saved');
      toast.success('Draft saved for admin review');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save draft');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Export Handlers ────────────────────────────────────────────────────────

  const handleDownloadPdf = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const pageWidth = form.pageSize === 'legal' ? 216 : 215.9;
      const pageHeight = form.pageSize === 'legal' ? 355.6 : 279.4;
      const doc = new jsPDF({ unit: 'mm', format: [pageWidth, pageHeight] });

      const margin = 25.4; // 1 inch
      const contentWidth = pageWidth - margin * 2;
      let y = margin;

      // Header
      if (form.includeHeader) {
        doc.setFontSize(10);
        doc.setFont('times', 'bold');
        doc.text('BROUSSARD LEGAL SERVICES', pageWidth / 2, y, { align: 'center' });
        y += 5;
        doc.setFontSize(8);
        doc.setFont('times', 'normal');
        const headerText = form.headerText || `${form.clientName}${form.caseRef ? ` · ${form.caseRef}` : ''} · broussardlegalservices.com`;
        doc.text(headerText, pageWidth / 2, y, { align: 'center' });
        y += 3;
        doc.setDrawColor(100, 100, 100);
        doc.line(margin, y, pageWidth - margin, y);
        y += 8;
      }

      // Watermark text
      const watermarkOption = WATERMARK_OPTIONS.find(w => w.id === form.watermark);
      if (watermarkOption?.text) {
        doc.saveGraphicsState();
        doc.setGState(doc.GState({ opacity: 0.08 }));
        doc.setFontSize(48);
        doc.setFont('times', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(watermarkOption.text, pageWidth / 2, pageHeight / 2, { align: 'center', angle: 45 });
        doc.restoreGraphicsState();
        doc.setTextColor(0, 0, 0);
      }

      // Title
      doc.setFontSize(14);
      doc.setFont('times', 'bold');
      doc.text(form.title || 'Legal Document', pageWidth / 2, y, { align: 'center' });
      y += 10;

      // Body content
      doc.setFontSize(12);
      doc.setFont('times', 'normal');
      const lines = doc.splitTextToSize(draftContent, contentWidth);
      const lineHeight = 6;

      for (const line of lines) {
        if (y + lineHeight > pageHeight - margin - (form.includeFooter ? 15 : 0)) {
          doc.addPage();
          y = margin;
        }
        doc.text(line, margin, y);
        y += lineHeight;
      }

      // Footer
      if (form.includeFooter) {
        const totalPages = doc.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          doc.setPage(i);
          doc.setFontSize(8);
          doc.setFont('times', 'normal');
          doc.setDrawColor(100, 100, 100);
          doc.line(margin, pageHeight - margin, pageWidth - margin, pageHeight - margin);
          const footerText = form.footerText || 'Broussard Legal Services · Professional. Precise. Client-Focused.';
          doc.text(footerText, pageWidth / 2, pageHeight - margin + 4, { align: 'center' });
          doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - margin + 4, { align: 'right' });
        }
      }

      const filename = `${(form.title || 'legal-document').replace(/[^a-zA-Z0-9\s]/g, '').trim()}.pdf`;
      doc.save(filename);
      toast.success('PDF downloaded');
    } catch {
      toast.error('PDF export failed — try Print/PDF instead');
    }
  };

  const handlePrint = () => {
    const printHtml = buildPrintDocument(form, draftContent);
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      toast.error('Pop-up blocked. Please allow pop-ups to print.');
      return;
    }
    printWindow.document.write(printHtml);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 500);
  };

  const handleDownloadHtml = () => {
    const html = buildHtmlEmbed(form, draftContent);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${form.title.replace(/[^a-zA-Z0-9\s]/g, '').trim() || 'legal-document'}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('HTML document downloaded');
  };

  const handleDownloadRtf = () => {
    const rtf = buildRtfDocument(form, draftContent);
    const blob = new Blob([rtf], { type: 'application/rtf;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${form.title.replace(/[^a-zA-Z0-9\s]/g, '').trim() || 'legal-document'}.rtf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('RTF document downloaded');
  };

  const handleDownloadTxt = () => {
    const pageLabel = PAGE_SIZES.find(p => p.id === form.pageSize)?.label ?? '';
    const watermarkOption = WATERMARK_OPTIONS.find(w => w.id === form.watermark)!;
    const watermarkLine = watermarkOption.text ? `[${watermarkOption.text}]\n\n` : watermarkOption.isImage ? '[BROUSSARD LEGAL SERVICES — BL MONOGRAM WATERMARK]\n\n' : '';
    const headerLine = form.includeHeader
      ? `BROUSSARD LEGAL SERVICES\n${form.headerText || `${form.clientName}${form.caseRef ? ` · ${form.caseRef}` : ''} · broussardlegalservices.com`}\n${'─'.repeat(60)}\n\n`
      : '';
    const footerLine = form.includeFooter
      ? `\n\n${'─'.repeat(60)}\nProfessional. Precise. Client-Focused.\n${form.footerText || 'Broussard Legal Services · Louisiana & Nationwide · broussardlegalservices.com'}`
      : '';
    const fullText = `${watermarkLine}${headerLine}${draftContent}${footerLine}`;
    const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${form.title.replace(/[^a-zA-Z0-9\s]/g, '').trim() || 'legal-document'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Document downloaded');
  };

  const handleCopyHtmlEmbed = () => {
    const html = buildHtmlEmbed(form, draftContent);
    navigator.clipboard.writeText(html).then(() => {
      toast.success('HTML embed code copied to clipboard');
    }).catch(() => {
      toast.error('Could not copy to clipboard');
    });
  };

  const handleExport = () => {
    switch (form.embedFormat) {
      case 'print': handlePrint(); break;
      case 'html':  handleDownloadHtml(); break;
      case 'rtf':   handleDownloadRtf(); break;
      case 'txt':   handleDownloadTxt(); break;
    }
  };

  const handleReset = () => {
    setForm({
      documentType: 'motion',
      title: '',
      clientName: prefillClientName,
      clientEmail: '',
      caseRef: prefillCaseRef,
      serviceType: '',
      caseFacts: '',
      customInstructions: '',
      pageSize: 'letter',
      watermark: 'bl_logo',
      includeHeader: true,
      includeFooter: true,
      headerText: '',
      footerText: '',
      embedFormat: 'print',
    });
    setDraftContent('');
    setSavedDraftId(null);
    setStep('configure');
    setShowSymbolPanel(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-secondary/50 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">📝</span>
            <div>
              <p className="text-sm font-semibold text-foreground">Draft Legal Document</p>
              <p className="text-[10px] text-muted-foreground">Lexi · AI-Powered · Attorney Review Required</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-border/50 transition-colors"
          >
            ← Back to Chat
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1 mt-3">
          {(['configure', 'review', 'saved'] as const).map((s, i) => {
            const labels = ['Configure', 'Review Draft', 'Saved'];
            const isDone =
              (s === 'configure' && (step === 'review' || step === 'saved' || step === 'drafting')) ||
              (s === 'review' && step === 'saved');
            const isActive = step === s || (step === 'drafting' && s === 'configure');
            return (
              <React.Fragment key={s}>
                <div className={`flex items-center gap-1 ${isActive ? 'text-primary' : isDone ? 'text-green-600' : 'text-muted-foreground'}`}>
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border ${
                      isActive
                        ? 'bg-primary text-white border-primary'
                        : isDone
                        ? 'bg-green-100 text-green-700 border-green-300' : 'bg-secondary border-border'
                    }`}
                  >
                    {isDone ? '✓' : i + 1}
                  </div>
                  <span className="text-[10px] font-medium hidden sm:inline">{labels[i]}</span>
                </div>
                {i < 2 && <div className={`flex-1 h-px ${isDone ? 'bg-green-300' : 'bg-border'}`} />}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* ── CONFIGURE STEP ── */}
        {(step === 'configure' || step === 'drafting') && (
          <div className="flex flex-col gap-4">
            {/* Document type selector */}
            <div>
              <p className="text-xs font-semibold text-foreground mb-2">Document Type</p>
              <div className="grid grid-cols-1 gap-2">
                {DOCUMENT_TYPES.map(dt => (
                  <button
                    key={dt.id}
                    onClick={() => updateForm('documentType', dt.id)}
                    disabled={isDrafting}
                    className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                      form.documentType === dt.id
                        ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20' : 'border-border bg-background hover:border-primary/30'
                    }`}
                  >
                    <span className="text-lg mt-0.5 shrink-0">{dt.icon}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground">{dt.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{dt.description}</p>
                    </div>
                    {form.documentType === dt.id && (
                      <div className="ml-auto shrink-0 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Document title */}
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1.5">
                Document Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={e => updateForm('title', e.target.value)}
                disabled={isDrafting}
                placeholder={`e.g., Motion to Compel Discovery — Smith v. Jones`}
                className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
              />
            </div>

            {/* Client info */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1.5">
                  Client Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.clientName}
                  onChange={e => updateForm('clientName', e.target.value)}
                  disabled={isDrafting}
                  placeholder="Full name"
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1.5">Case / Matter Ref</label>
                <input
                  type="text"
                  value={form.caseRef}
                  onChange={e => updateForm('caseRef', e.target.value)}
                  disabled={isDrafting}
                  placeholder="e.g., 2024-CV-001"
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1.5">Client Email</label>
                <input
                  type="email"
                  value={form.clientEmail}
                  onChange={e => updateForm('clientEmail', e.target.value)}
                  disabled={isDrafting}
                  placeholder="client@email.com"
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1.5">Service Type</label>
                <select
                  value={form.serviceType}
                  onChange={e => updateForm('serviceType', e.target.value)}
                  disabled={isDrafting}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                >
                  <option value="">Select…</option>
                  {SERVICE_TYPES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* ── Document Formatting ── */}
            <div className="border border-border rounded-xl p-3 bg-secondary/30">
              <p className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
                <span>📐</span> Document Formatting
              </p>

              {/* Page Size */}
              <div className="mb-3">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Page Size</label>
                <div className="grid grid-cols-2 gap-2">
                  {PAGE_SIZES.map(ps => (
                    <button
                      key={ps.id}
                      onClick={() => updateForm('pageSize', ps.id)}
                      disabled={isDrafting}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        form.pageSize === ps.id
                          ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20' :'border-border bg-background hover:border-primary/30'
                      }`}
                    >
                      <p className="text-[10px] font-semibold text-foreground">{ps.id === 'letter' ? '📄 Letter' : '📋 Legal'}</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">{ps.dimensions}</p>
                    </button>
                  ))}
                </div>
                <p className="text-[9px] text-muted-foreground mt-1.5">Font: Times New Roman 12pt · Black · Double-spaced</p>
              </div>

              {/* Watermark */}
              <div className="mb-3">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Watermark</label>
                <select
                  value={form.watermark}
                  onChange={e => updateForm('watermark', e.target.value)}
                  disabled={isDrafting}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {WATERMARK_OPTIONS.map(w => (
                    <option key={w.id} value={w.id}>{w.label}</option>
                  ))}
                </select>
                {form.watermark === 'bl_logo' && (
                  <p className="text-[9px] text-muted-foreground mt-1">BL circle monogram will appear as a faint centered watermark on every page.</p>
                )}
              </div>

              {/* Header & Footer toggles */}
              <div className="flex gap-3 mb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.includeHeader}
                    onChange={e => updateForm('includeHeader', e.target.checked)}
                    disabled={isDrafting}
                    className="w-3.5 h-3.5 rounded accent-primary"
                  />
                  <span className="text-[10px] font-semibold text-foreground">Broussard Logo Header</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.includeFooter}
                    onChange={e => updateForm('includeFooter', e.target.checked)}
                    disabled={isDrafting}
                    className="w-3.5 h-3.5 rounded accent-primary"
                  />
                  <span className="text-[10px] font-semibold text-foreground">Tagline Footer</span>
                </label>
              </div>

              {form.includeHeader && (
                <input
                  type="text"
                  value={form.headerText}
                  onChange={e => updateForm('headerText', e.target.value)}
                  disabled={isDrafting}
                  placeholder={`Sub-header text (default: ${form.clientName || 'Client Name'} · broussardlegalservices.com)`}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 mb-2"
                />
              )}
              {form.includeFooter && (
                <input
                  type="text"
                  value={form.footerText}
                  onChange={e => updateForm('footerText', e.target.value)}
                  disabled={isDrafting}
                  placeholder="Footer sub-text (default: Broussard Legal Services · broussardlegalservices.com)"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              )}

              {/* Embed Format */}
              <div className="mt-3">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Export / Embed Format</label>
                <div className="grid grid-cols-2 gap-2">
                  {EMBED_FORMATS.map(ef => (
                    <button
                      key={ef.id}
                      onClick={() => updateForm('embedFormat', ef.id)}
                      disabled={isDrafting}
                      className={`p-2 rounded-lg border text-left transition-all ${
                        form.embedFormat === ef.id
                          ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20' : 'border-border bg-background hover:border-primary/30'
                      }`}
                    >
                      <p className="text-[10px] font-semibold text-foreground">{ef.icon} {ef.label}</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight">{ef.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Case facts */}
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1.5">
                Case Facts & Context <span className="text-red-500">*</span>
              </label>
              <p className="text-[10px] text-muted-foreground mb-2">
                Describe the relevant facts, parties, claims, and any specific points to address in the document.
              </p>
              <textarea
                value={form.caseFacts}
                onChange={e => updateForm('caseFacts', e.target.value)}
                disabled={isDrafting}
                rows={6}
                placeholder="e.g., Client John Smith entered into a contract with ABC Corp on Jan 1, 2024 for software development services. ABC Corp failed to deliver the agreed software by the March 1 deadline despite receiving full payment of $50,000. Client is seeking to compel production of all communications related to the project..."
                className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-none"
              />
            </div>

            {/* Custom instructions */}
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1.5">
                Special Instructions <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <textarea
                value={form.customInstructions}
                onChange={e => updateForm('customInstructions', e.target.value)}
                disabled={isDrafting}
                rows={3}
                placeholder="e.g., Emphasize the breach of contract claim, include a 10-day response deadline, reference Louisiana Civil Code Art. 1994..."
                className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-none"
              />
            </div>

            {/* Disclaimer */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <div className="flex items-start gap-2">
                <span className="text-amber-600 text-sm shrink-0">⚠️</span>
                <p className="text-[10px] text-amber-800 leading-relaxed">
                  AI-generated drafts require attorney review before use. Lexi will insert [PLACEHOLDER] markers where case-specific details are needed. All drafts are saved for admin review before sending.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── DRAFTING STEP ── */}
        {step === 'drafting' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground">Lexi is drafting your {selectedDocType.label}…</p>
              <p className="text-xs text-muted-foreground mt-1">Analyzing case facts and applying legal templates</p>
            </div>
          </div>
        )}

        {/* ── REVIEW STEP ── */}
        {step === 'review' && (
          <div className="flex flex-col gap-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-3">
              <div className="flex items-start gap-2">
                <span className="text-green-600 text-sm shrink-0">✅</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-green-800">Draft Generated</p>
                  <p className="text-[10px] text-green-700 mt-0.5">
                    {selectedDocType.icon} {form.title} — {form.clientName}
                    {form.caseRef ? ` · ${form.caseRef}` : ''}
                  </p>
                </div>
              </div>
            </div>

            {/* Branding preview */}
            <div className="border border-border rounded-xl overflow-hidden bg-white">
              <div className="bg-secondary/40 px-3 py-1.5 border-b border-border">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Document Branding Preview</p>
              </div>
              {form.includeHeader && (
                <div className="flex flex-col items-center py-3 px-4 border-b border-dashed border-border">
                  <img
                    src={BROUSSARD_LOGO}
                    alt="Broussard Legal Services"
                    className="max-w-[200px] w-full h-auto object-contain"
                  />
                  <p className="text-[9px] text-muted-foreground mt-1">
                    {form.headerText || `${form.clientName || 'Client Name'}${form.caseRef ? ` · ${form.caseRef}` : ''} · broussardlegalservices.com`}
                  </p>
                </div>
              )}
              <div className="flex items-center justify-center py-2 px-4 gap-3">
                {form.watermark === 'bl_logo' && (
                  <div className="flex items-center gap-1.5">
                    <img src={BL_MONOGRAM} alt="BL Watermark" className="w-6 h-6 object-contain opacity-30" />
                    <span className="text-[9px] text-muted-foreground">BL watermark</span>
                  </div>
                )}
                {form.watermark !== 'none' && form.watermark !== 'bl_logo' && (
                  <span className="text-[9px] text-muted-foreground italic opacity-50">{WATERMARK_OPTIONS.find(w => w.id === form.watermark)?.text}</span>
                )}
                <span className="text-[9px] text-muted-foreground">Times New Roman 12pt · {PAGE_SIZES.find(p => p.id === form.pageSize)?.label}</span>
              </div>
              {form.includeFooter && (
                <div className="flex flex-col items-center py-3 px-4 border-t border-dashed border-border">
                  <img
                    src={FOOTER_IMAGE}
                    alt="Professional. Precise. Client-Focused."
                    className="max-w-[200px] w-full h-auto object-contain"
                  />
                  <p className="text-[9px] text-muted-foreground mt-1">
                    {form.footerText || 'Broussard Legal Services · Louisiana & Nationwide · broussardlegalservices.com'}
                  </p>
                </div>
              )}
            </div>

            {/* Formatting summary */}
            <div className="bg-secondary/50 border border-border rounded-xl p-3 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
              <span>📐 {PAGE_SIZES.find(p => p.id === form.pageSize)?.label}</span>
              <span>🔤 Times New Roman 12pt · Black</span>
              {form.watermark !== 'none' && <span>💧 {WATERMARK_OPTIONS.find(w => w.id === form.watermark)?.label}</span>}
              {form.includeHeader && <span>⬆️ Logo Header</span>}
              {form.includeFooter && <span>⬇️ Tagline Footer</span>}
              <span>📦 {EMBED_FORMATS.find(e => e.id === form.embedFormat)?.label}</span>
            </div>

            {/* Draft content + symbol insert */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-foreground">Draft Content</p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">{draftContent.length} chars</span>
                  <button
                    onClick={() => setShowSymbolPanel(prev => !prev)}
                    className={`text-[10px] font-semibold px-2 py-1 rounded-lg border transition-all ${showSymbolPanel ? 'bg-primary/10 border-primary/40 text-primary' : 'border-border text-muted-foreground hover:text-foreground hover:bg-secondary'}`}
                  >
                    § Insert Symbol
                  </button>
                </div>
              </div>

              {/* Symbol quick-insert panel */}
              {showSymbolPanel && (
                <div className="mb-2 border border-primary/20 rounded-xl bg-primary/3 p-3">
                  <p className="text-[10px] font-semibold text-primary mb-2">Click a symbol to insert at cursor position</p>
                  <div className="flex flex-wrap gap-1">
                    {QUICK_SYMBOLS.map(s => (
                      <button
                        key={s.symbol}
                        onClick={() => insertSymbol(s.symbol)}
                        title={s.name}
                        className="px-2 py-1 bg-background border border-border rounded text-xs font-serif text-foreground hover:bg-primary/10 hover:border-primary/40 transition-all"
                      >
                        {s.symbol}
                      </button>
                    ))}
                  </div>
                  <p className="text-[9px] text-muted-foreground mt-2">Hover over a symbol to see its name. Symbols are inserted at your cursor position in the draft below.</p>
                </div>
              )}

              <textarea
                ref={draftTextareaRef}
                value={draftContent}
                onChange={e => setDraftContent(e.target.value)}
                rows={20}
                className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-none leading-relaxed"
              />
              <p className="text-[10px] text-muted-foreground mt-1">You can edit the draft above before saving or printing. Use § Insert Symbol to drop legal symbols at the cursor.</p>
            </div>

            {/* Export actions */}
            <div className="border border-border rounded-xl p-3 bg-secondary/20">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Export Document</p>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <button
                  onClick={handleExport}
                  className="flex items-center justify-center gap-1.5 py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-semibold hover:opacity-90 transition-all"
                >
                  {form.embedFormat === 'print' ? (
                    <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> Print / PDF</>
                  ) : (
                    <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download {EMBED_FORMATS.find(e => e.id === form.embedFormat)?.label}</>
                  )}
                </button>
                {form.embedFormat === 'html' && (
                  <button
                    onClick={handleCopyHtmlEmbed}
                    className="flex items-center justify-center gap-1.5 py-2.5 border border-border text-foreground rounded-xl text-xs font-semibold hover:bg-secondary transition-all"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    Copy HTML
                  </button>
                )}
                {form.embedFormat !== 'html' && (
                  <button
                    onClick={handleDownloadTxt}
                    className="flex items-center justify-center gap-1.5 py-2.5 border border-border text-foreground rounded-xl text-xs font-semibold hover:bg-secondary transition-all"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    .txt Backup
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handlePrint}
                  className="flex-1 flex items-center justify-center gap-1 py-2 border border-border text-foreground rounded-lg text-[10px] font-semibold hover:bg-secondary transition-all"
                >
                  🖨️ Print
                </button>
                <button
                  onClick={handleDownloadPdf}
                  className="flex-1 flex items-center justify-center gap-1 py-2 border border-red-200 text-red-700 bg-red-50 rounded-lg text-[10px] font-semibold hover:bg-red-100 transition-all"
                >
                  📕 PDF
                </button>
                <button
                  onClick={handleDownloadHtml}
                  className="flex-1 flex items-center justify-center gap-1 py-2 border border-border text-foreground rounded-lg text-[10px] font-semibold hover:bg-secondary transition-all"
                >
                  🌐 HTML
                </button>
                <button
                  onClick={handleDownloadRtf}
                  className="flex-1 flex items-center justify-center gap-1 py-2 border border-border text-foreground rounded-lg text-[10px] font-semibold hover:bg-secondary transition-all"
                >
                  📝 RTF
                </button>
                <button
                  onClick={handleDownloadTxt}
                  className="flex-1 flex items-center justify-center gap-1 py-2 border border-border text-foreground rounded-lg text-[10px] font-semibold hover:bg-secondary transition-all"
                >
                  📄 TXT
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── SAVED STEP ── */}
        {step === 'saved' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Draft Saved for Review</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                The {selectedDocType.label} for <strong>{form.clientName}</strong> has been queued for admin review. An attorney will review and send the document.
              </p>
            </div>
            <div className="bg-secondary border border-border rounded-xl p-3 w-full text-left">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold mb-2">Draft Summary</p>
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-medium text-foreground">{selectedDocType.icon} {selectedDocType.label}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Client</span>
                  <span className="font-medium text-foreground">{form.clientName}</span>
                </div>
                {form.caseRef && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Matter</span>
                    <span className="font-medium text-foreground">{form.caseRef}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Format</span>
                  <span className="font-medium text-foreground">{PAGE_SIZES.find(p => p.id === form.pageSize)?.label} · TNR 12pt</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Branding</span>
                  <span className="font-medium text-foreground">Logo Header · {WATERMARK_OPTIONS.find(w => w.id === form.watermark)?.label} · Tagline Footer</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-medium text-amber-700">Pending Review</span>
                </div>
              </div>
            </div>
            <button
              onClick={handleReset}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-semibold hover:opacity-90 transition-all"
            >
              Draft Another Document
            </button>
          </div>
        )}
      </div>

      {/* Footer actions */}
      {(step === 'configure' || step === 'drafting') && (
        <div className="px-4 py-3 border-t border-border bg-background shrink-0">
          <button
            onClick={handleDraft}
            disabled={isDrafting || !form.clientName.trim() || !form.caseFacts.trim() || !form.title.trim()}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-semibold hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isDrafting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                Generating Draft…
              </>
            ) : (
              <>✨ Generate {selectedDocType.label} Draft</>
            )}
          </button>
        </div>
      )}

      {step === 'review' && (
        <div className="px-4 py-3 border-t border-border bg-background shrink-0 flex gap-2">
          <button
            onClick={() => setStep('configure')}
            className="flex-1 py-2.5 border border-border text-foreground rounded-xl text-xs font-semibold hover:bg-secondary transition-all"
          >
            ← Revise
          </button>
          <button
            onClick={handleSaveForReview}
            disabled={isSaving}
            className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-semibold hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                Saving…
              </>
            ) : (
              '💾 Save for Admin Review'
            )}
          </button>
        </div>
      )}
    </div>
  );
}
