'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const PARALEGAL_NAME = 'Maggi May Broussard';
const PARALEGAL_EMAIL = 'broussardlegalservices@gmail.com';
const SITE_URL = 'https://broussardlegalservices.com';
const PRICING_URL = `${SITE_URL}/pricing`;

async function downloadAsPDF(element: HTMLDivElement, filename: string) {
  const { default: jsPDF } = await import('jspdf');
  const { default: html2canvas } = await import('html2canvas');
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    windowWidth: 900,
  });
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 30;
  const contentWidth = pageWidth - margin * 2;
  const imgHeight = (canvas.height * contentWidth) / canvas.width;
  let yOffset = 0;
  let remainingHeight = imgHeight;
  while (remainingHeight > 0) {
    if (yOffset > 0) pdf.addPage();
    pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, imgHeight, undefined, 'FAST', 0, -yOffset);
    yOffset += pageHeight - margin * 2;
    remainingHeight -= pageHeight - margin * 2;
  }
  pdf.save(filename);
}

function LogHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="border-b-2 pb-4 mb-5" style={{ borderColor: '#355E3B' }}>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: '#355E3B' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#C8965A' }}>Broussard Legal Services</p>
          <p className="text-xs text-gray-500">{PARALEGAL_EMAIL}</p>
        </div>
      </div>
      <h2 className="font-serif text-xl font-bold mb-1" style={{ color: '#1a2e1a' }}>{title}</h2>
      {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-400">
        <span>Matter: _________________</span>
        <span>Case No.: _________________</span>
        <span>Prepared by: _________________</span>
        <span>Date: _________________</span>
      </div>
    </div>
  );
}

// ── 1. Discovery Management Log ────────────────────────────────────────────────
function DiscoveryManagementLog() {
  return (
    <div className="bg-white p-6 font-sans text-gray-800" style={{ minWidth: 800 }}>
      <LogHeader title="Discovery Management Log" subtitle="Track all discovery requests, responses, and deadlines" />
      <p className="text-xs text-gray-500 mb-3">For discovery management services, visit: <strong>{PRICING_URL}</strong></p>

      <div className="mb-5">
        <h3 className="font-semibold text-xs uppercase tracking-wider mb-2" style={{ color: '#355E3B' }}>Interrogatories</h3>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr style={{ background: '#355E3B', color: 'white' }}>
              {['#', 'Sent To', 'Date Served', 'Response Due', 'Date Received', 'Complete?', 'Follow-Up Needed', 'Notes'].map(h => (
                <th key={h} className="p-2 text-left border border-green-800 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5].map(i => (
              <tr key={i} className="border-b border-gray-100">
                <td className="p-2 border border-gray-200 text-center text-gray-400">{i}</td>
                {[...Array(7)].map((_, j) => (
                  <td key={j} className="p-2 border border-gray-200 h-7" />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mb-5">
        <h3 className="font-semibold text-xs uppercase tracking-wider mb-2" style={{ color: '#355E3B' }}>Requests for Production (RFP)</h3>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr style={{ background: '#355E3B', color: 'white' }}>
              {['#', 'Request Description', 'Sent To', 'Date Served', 'Response Due', 'Docs Received', 'Bates Range', 'Status'].map(h => (
                <th key={h} className="p-2 text-left border border-green-800 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5].map(i => (
              <tr key={i} className="border-b border-gray-100">
                <td className="p-2 border border-gray-200 text-center text-gray-400">{i}</td>
                {[...Array(7)].map((_, j) => (
                  <td key={j} className="p-2 border border-gray-200 h-7" />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mb-5">
        <h3 className="font-semibold text-xs uppercase tracking-wider mb-2" style={{ color: '#355E3B' }}>Requests for Admission (RFA)</h3>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr style={{ background: '#355E3B', color: 'white' }}>
              {['#', 'Admission Requested', 'Sent To', 'Date Served', 'Response Due', 'Response', 'Objections', 'Notes'].map(h => (
                <th key={h} className="p-2 text-left border border-green-800 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3].map(i => (
              <tr key={i} className="border-b border-gray-100">
                <td className="p-2 border border-gray-200 text-center text-gray-400">{i}</td>
                {[...Array(7)].map((_, j) => (
                  <td key={j} className="p-2 border border-gray-200 h-7" />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 pt-3 border-t border-gray-200 text-xs text-gray-400">
        <p>Prepared by {PARALEGAL_NAME} · {PARALEGAL_EMAIL} · For pricing: {PRICING_URL}</p>
      </div>
    </div>
  );
}

// ── 2. Privilege Log ───────────────────────────────────────────────────────────
function PrivilegeLog() {
  return (
    <div className="bg-white p-6 font-sans text-gray-800" style={{ minWidth: 800 }}>
      <LogHeader title="Privilege Log" subtitle="Attorney-Client Privilege & Work Product Protection Log" />
      <p className="text-xs text-gray-500 mb-3">
        This log identifies documents withheld from production on privilege grounds. For discovery management services, visit: <strong>{PRICING_URL}</strong>
      </p>

      <table className="w-full text-xs border-collapse mb-5">
        <thead>
          <tr style={{ background: '#355E3B', color: 'white' }}>
            {['Doc #', 'Bates / Control #', 'Date', 'Author', 'Recipient(s)', 'CC', 'Document Type', 'Privilege Basis', 'Subject Matter', 'Withheld / Redacted'].map(h => (
              <th key={h} className="p-2 text-left border border-green-800 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <tr key={i} className="border-b border-gray-100">
              <td className="p-2 border border-gray-200 text-center text-gray-400">{i}</td>
              {[...Array(9)].map((_, j) => (
                <td key={j} className="p-2 border border-gray-200 h-8" />
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-800 mb-4">
        <strong>Privilege Basis Codes:</strong> AC = Attorney-Client Privilege · WP = Work Product Doctrine · JDA = Joint Defense Agreement · CI = Common Interest · OTH = Other (specify in notes)
      </div>

      <div className="mt-4 pt-3 border-t border-gray-200 text-xs text-gray-400">
        <p>Prepared by {PARALEGAL_NAME} · {PARALEGAL_EMAIL} · For pricing: {PRICING_URL}</p>
        <p className="mt-1 text-gray-300">⚠ This log must be reviewed and certified by supervising counsel before production.</p>
      </div>
    </div>
  );
}

// ── 3. Legal Research Log ──────────────────────────────────────────────────────
function LegalResearchLog() {
  return (
    <div className="bg-white p-6 font-sans text-gray-800" style={{ minWidth: 800 }}>
      <LogHeader title="Legal Research Log" subtitle="Track research tasks, sources, and memo drafting status" />
      <p className="text-xs text-gray-500 mb-3">For legal research and memo drafting services, visit: <strong>{PRICING_URL}</strong></p>

      <table className="w-full text-xs border-collapse mb-5">
        <thead>
          <tr style={{ background: '#355E3B', color: 'white' }}>
            {['#', 'Research Issue / Question', 'Jurisdiction', 'Key Cases / Statutes', 'Database Used', 'Date Researched', 'Memo Drafted?', 'Memo File Name', 'Attorney Reviewed', 'Notes'].map(h => (
              <th key={h} className="p-2 text-left border border-green-800 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <tr key={i} className="border-b border-gray-100">
              <td className="p-2 border border-gray-200 text-center text-gray-400">{i}</td>
              {[...Array(9)].map((_, j) => (
                <td key={j} className="p-2 border border-gray-200 h-8" />
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mb-5">
        <h3 className="font-semibold text-xs uppercase tracking-wider mb-2" style={{ color: '#355E3B' }}>Research Summary Notes</h3>
        <div className="border border-gray-200 rounded p-3 space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="border-b border-gray-100 pb-3">
              <div className="flex gap-4 mb-1">
                <div className="flex-1">
                  <p className="text-xs text-gray-400 mb-0.5">Issue #{i}</p>
                  <div className="border-b border-gray-300 h-5" />
                </div>
                <div className="w-32">
                  <p className="text-xs text-gray-400 mb-0.5">Conclusion</p>
                  <div className="border-b border-gray-300 h-5" />
                </div>
              </div>
              <p className="text-xs text-gray-400 mb-0.5">Key Authority</p>
              <div className="border border-gray-200 rounded h-10" />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-gray-200 text-xs text-gray-400">
        <p>Prepared by {PARALEGAL_NAME} · {PARALEGAL_EMAIL} · For pricing: {PRICING_URL}</p>
      </div>
    </div>
  );
}

// ── 4. Motion & Brief Drafting Log ─────────────────────────────────────────────
function MotionBriefLog() {
  return (
    <div className="bg-white p-6 font-sans text-gray-800" style={{ minWidth: 800 }}>
      <LogHeader title="Motion & Brief Drafting Log" subtitle="Track all motions, briefs, and filing deadlines" />
      <p className="text-xs text-gray-500 mb-3">For motion and brief drafting services, visit: <strong>{PRICING_URL}</strong></p>

      <table className="w-full text-xs border-collapse mb-5">
        <thead>
          <tr style={{ background: '#355E3B', color: 'white' }}>
            {['#', 'Document Title', 'Type', 'Court / Jurisdiction', 'Draft Started', 'Draft Due', 'Filing Deadline', 'Attorney Review', 'Filed Date', 'Confirmation #', 'Status'].map(h => (
              <th key={h} className="p-2 text-left border border-green-800 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <tr key={i} className="border-b border-gray-100">
              <td className="p-2 border border-gray-200 text-center text-gray-400">{i}</td>
              {[...Array(10)].map((_, j) => (
                <td key={j} className="p-2 border border-gray-200 h-8" />
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="grid grid-cols-2 gap-4 mb-5">
        <div>
          <h3 className="font-semibold text-xs uppercase tracking-wider mb-2" style={{ color: '#355E3B' }}>Document Type Codes</h3>
          <div className="bg-gray-50 rounded p-3 text-xs text-gray-600 space-y-1">
            {[
              ['MTN', 'Motion'],
              ['OPP', 'Opposition / Response'],
              ['RPL', 'Reply Brief'],
              ['MEM', 'Memorandum of Law'],
              ['APP', 'Appellate Brief'],
              ['SUM', 'Summary Judgment Brief'],
              ['OTH', 'Other (specify)'],
            ].map(([code, label]) => (
              <div key={code} className="flex gap-2">
                <span className="font-bold w-10" style={{ color: '#C8965A' }}>{code}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="font-semibold text-xs uppercase tracking-wider mb-2" style={{ color: '#355E3B' }}>Status Codes</h3>
          <div className="bg-gray-50 rounded p-3 text-xs text-gray-600 space-y-1">
            {[
              ['DRAFT', 'In drafting'],
              ['REVIEW', 'Attorney review'],
              ['REVISE', 'Revisions needed'],
              ['FINAL', 'Final approved'],
              ['FILED', 'Filed with court'],
              ['CONF', 'Filing confirmed'],
            ].map(([code, label]) => (
              <div key={code} className="flex gap-2">
                <span className="font-bold w-14" style={{ color: '#C8965A' }}>{code}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-gray-200 text-xs text-gray-400">
        <p>Prepared by {PARALEGAL_NAME} · {PARALEGAL_EMAIL} · For pricing: {PRICING_URL}</p>
      </div>
    </div>
  );
}

// ── 5. Case Management Log ─────────────────────────────────────────────────────
function CaseManagementLog() {
  return (
    <div className="bg-white p-6 font-sans text-gray-800" style={{ minWidth: 800 }}>
      <LogHeader title="Case Management Log" subtitle="Comprehensive case activity and status tracker" />
      <p className="text-xs text-gray-500 mb-3">For case management services, visit: <strong>{PRICING_URL}</strong></p>

      <div className="mb-5">
        <h3 className="font-semibold text-xs uppercase tracking-wider mb-2" style={{ color: '#355E3B' }}>Case Activity Log</h3>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr style={{ background: '#355E3B', color: 'white' }}>
              {['Date', 'Time', 'Activity Type', 'Description', 'Performed By', 'Hours', 'Billable?', 'Follow-Up Required', 'Due Date'].map(h => (
                <th key={h} className="p-2 text-left border border-green-800 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <tr key={i} className="border-b border-gray-100">
                {[...Array(9)].map((_, j) => (
                  <td key={j} className="p-2 border border-gray-200 h-8" />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mb-5">
        <h3 className="font-semibold text-xs uppercase tracking-wider mb-2" style={{ color: '#355E3B' }}>Key Deadlines & Milestones</h3>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr style={{ background: '#C8965A', color: 'white' }}>
              {['Deadline / Event', 'Date', 'Court / Authority', 'Responsible Party', 'Calendared?', 'Reminder Set?', 'Completed', 'Notes'].map(h => (
                <th key={h} className="p-2 text-left border border-yellow-700 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5].map(i => (
              <tr key={i} className="border-b border-gray-100">
                {[...Array(8)].map((_, j) => (
                  <td key={j} className="p-2 border border-gray-200 h-8" />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 pt-3 border-t border-gray-200 text-xs text-gray-400">
        <p>Prepared by {PARALEGAL_NAME} · {PARALEGAL_EMAIL} · For pricing: {PRICING_URL}</p>
      </div>
    </div>
  );
}

// ── Log card data ──────────────────────────────────────────────────────────────
interface LogCard {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: React.ReactNode;
  component: React.ReactNode;
  filename: string;
}

const LOG_CARDS: LogCard[] = [
  {
    id: 'discovery',
    title: 'Discovery Management Log',
    description: 'Track interrogatories, RFPs, and RFAs with deadlines, responses, and Bates ranges.',
    category: 'Discovery',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
    component: <DiscoveryManagementLog />,
    filename: 'Discovery_Management_Log.pdf',
  },
  {
    id: 'privilege',
    title: 'Privilege Log',
    description: 'Attorney-client privilege and work product log with Bates numbers and privilege basis codes.',
    category: 'Discovery',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
    component: <PrivilegeLog />,
    filename: 'Privilege_Log.pdf',
  },
  {
    id: 'research',
    title: 'Legal Research Log',
    description: 'Track research issues, key authorities, memo drafting status, and attorney review.',
    category: 'Research',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
    component: <LegalResearchLog />,
    filename: 'Legal_Research_Log.pdf',
  },
  {
    id: 'motion',
    title: 'Motion & Brief Drafting Log',
    description: 'Track motions, briefs, filing deadlines, attorney review cycles, and court confirmations.',
    category: 'Drafting',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
    component: <MotionBriefLog />,
    filename: 'Motion_Brief_Drafting_Log.pdf',
  },
  {
    id: 'case',
    title: 'Case Management Log',
    description: 'Comprehensive case activity tracker with billable hours, deadlines, and milestone tracking.',
    category: 'Management',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
    component: <CaseManagementLog />,
    filename: 'Case_Management_Log.pdf',
  },
];

const CATEGORIES = ['All', 'Discovery', 'Research', 'Drafting', 'Management'];

export default function LogFormatsPage() {
  const [activeCategory, setActiveCategory] = useState('All');
  const [downloading, setDownloading] = useState<string | null>(null);
  const refs = useRef<Record<string, HTMLDivElement | null>>({});

  const filtered = activeCategory === 'All'
    ? LOG_CARDS
    : LOG_CARDS.filter(c => c.category === activeCategory);

  const handleDownload = async (card: LogCard) => {
    const el = refs.current[card.id];
    if (!el) return;
    setDownloading(card.id);
    try {
      await downloadAsPDF(el, card.filename);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <>
      <Header />
      <main className="min-h-screen pt-24 pb-20" style={{ background: '#FAF7F2' }}>

        {/* Hero */}
        <section className="max-w-5xl mx-auto px-4 md:px-8 mb-12">
          <div className="text-center mb-8">
            <span className="inline-block text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full mb-4" style={{ background: 'rgba(53,94,59,0.1)', color: '#355E3B' }}>
              Log Formats & Templates
            </span>
            <h1 className="font-serif text-4xl md:text-5xl font-bold mb-4" style={{ color: '#1a2e1a' }}>
              Professional Log Templates
            </h1>
            <p className="text-base text-gray-600 max-w-2xl mx-auto leading-relaxed">
              Download ready-to-use log formats for discovery management, privilege logs, legal research, motion drafting, and case management. All templates include embedded links to our{' '}
              <Link href="/pricing" className="font-semibold underline" style={{ color: '#355E3B' }}>pricing page</Link>.
            </p>
          </div>

          {/* Category filter */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className="px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-widest transition-all duration-200"
                style={activeCategory === cat
                  ? { background: '#355E3B', color: '#fff' }
                  : { background: 'rgba(53,94,59,0.08)', color: '#355E3B', border: '1px solid rgba(53,94,59,0.2)' }
                }
              >
                {cat}
              </button>
            ))}
          </div>
        </section>

        {/* Log Cards */}
        <section className="max-w-5xl mx-auto px-4 md:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            {filtered.map(card => (
              <div
                key={card.id}
                className="rounded-2xl border overflow-hidden flex flex-col"
                style={{ background: '#fff', borderColor: 'rgba(53,94,59,0.15)' }}
              >
                <div className="p-5 flex-1">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(53,94,59,0.1)', color: '#355E3B' }}>
                      {card.icon}
                    </div>
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#C8965A' }}>{card.category}</span>
                      <h3 className="font-serif text-base font-bold leading-snug mt-0.5" style={{ color: '#1a2e1a' }}>{card.title}</h3>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">{card.description}</p>
                </div>
                <div className="px-5 pb-5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownload(card)}
                    disabled={downloading === card.id}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all duration-200"
                    style={{ background: '#355E3B', color: '#fff', opacity: downloading === card.id ? 0.7 : 1 }}
                  >
                    {downloading === card.id ? (
                      <>
                        <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                        </svg>
                        Generating…
                      </>
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Download PDF
                      </>
                    )}
                  </button>
                  <Link
                    href="/pricing"
                    className="flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200"
                    style={{ background: 'rgba(200,150,90,0.12)', color: '#C8965A', border: '1px solid rgba(200,150,90,0.3)' }}
                    title="View Pricing"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* CTA Banner */}
          <div className="rounded-2xl p-8 text-center" style={{ background: 'linear-gradient(135deg, #355E3B 0%, #2a4a2f 100%)' }}>
            <h2 className="font-serif text-2xl font-bold text-white mb-2">Need Help Managing Your Case?</h2>
            <p className="text-sm text-white/75 mb-6 max-w-xl mx-auto">
              These log formats are included with all retainer plans. Let Maggi May handle your discovery management, legal research, and motion drafting.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold uppercase tracking-widest transition-all duration-200"
                style={{ background: '#C8965A', color: '#fff' }}
              >
                View Pricing Plans
              </Link>
              <Link
                href="/contracts"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold uppercase tracking-widest transition-all duration-200"
                style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)' }}
              >
                View Contracts
              </Link>
            </div>
          </div>
        </section>

        {/* Hidden render targets for PDF generation */}
        <div className="fixed -left-[9999px] -top-[9999px] pointer-events-none" aria-hidden="true">
          {LOG_CARDS.map(card => (
            <div key={card.id} ref={el => { refs.current[card.id] = el; }}>
              {card.component}
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
