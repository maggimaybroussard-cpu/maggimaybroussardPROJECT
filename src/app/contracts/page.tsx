'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Image from 'next/image';

const PARALEGAL_NAME = 'Maggi May Broussard';
const PARALEGAL_TITLE = 'Freelance Paralegal';
const PARALEGAL_EMAIL = 'broussardlegalservices@gmail.com';
const SITE_URL = 'https://broussardlegalservices.com';
const PRICING_URL = `${SITE_URL}/pricing`;
const FIRM_NAME = 'Broussard Legal Services';

// ── PDF download helper ────────────────────────────────────────────────────────
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
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  const imgHeight = (canvas.height * contentWidth) / canvas.width;

  let yOffset = 0;
  let remainingHeight = imgHeight;
  while (remainingHeight > 0) {
    if (yOffset > 0) pdf.addPage();
    const sliceHeight = Math.min(remainingHeight, pageHeight - margin * 2);
    pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, imgHeight, undefined, 'FAST', 0, -yOffset);
    yOffset += sliceHeight;
    remainingHeight -= sliceHeight;
  }
  pdf.save(filename);
}

// ── Letterhead / Footer image wrappers ────────────────────────────────────────

function ContractLetterhead() {
  return (
    <div className="w-full">
      <Image
        src="/assets/images/letterhead-1780100512052.png"
        alt="Broussard Legal Services letterhead"
        width={1200}
        height={200}
        className="w-full h-auto block"
        priority
      />
    </div>
  );
}

function ContractFooterImage() {
  return (
    <div className="w-full mt-4">
      <Image
        src="/assets/images/footer-1780100663536.png"
        alt="Broussard Legal Services footer"
        width={1200}
        height={120}
        className="w-full h-auto block"
      />
    </div>
  );
}

/** Wraps any document body with the branded letterhead at top and footer at bottom */
function DocumentWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white font-sans text-gray-800" style={{ minWidth: 700 }}>
      <ContractLetterhead />
      <div className="p-8">
        {children}
      </div>
      <ContractFooterImage />
    </div>
  );
}

// ── Contract document components ──────────────────────────────────────────────

function ContractHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="border-b-2 pb-6 mb-6" style={{ borderColor: '#355E3B' }}>
      <h2 className="font-serif text-2xl font-bold mb-1" style={{ color: '#1a2e1a' }}>{title}</h2>
      {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      <p className="text-xs text-gray-400 mt-2">Effective Date: _________________ &nbsp;|&nbsp; Client: _________________</p>
    </div>
  );
}

// ── Proprietary notice appended to every contract ─────────────────────────────
function ProprietaryNotice() {
  return (
    <div className="mt-8 pt-5 border-t-2 border-dashed" style={{ borderColor: '#355E3B' }}>
      <div className="rounded-lg p-4" style={{ background: '#f0f7f0', border: '1px solid #c6dfc8' }}>
        <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#355E3B' }}>
          ⚠ Proprietary Document — {FIRM_NAME}
        </p>
        <p className="text-xs text-gray-600 leading-relaxed">
          This contract and all associated forms are the exclusive property of <strong>{FIRM_NAME}</strong> ({PARALEGAL_EMAIL} · {SITE_URL}). These documents are prepared by and for the sole use of <strong>{FIRM_NAME}</strong> and its clients. Unauthorized reproduction, redistribution, or use of these documents outside of an engagement with <strong>{FIRM_NAME}</strong> is strictly prohibited. Any party using these documents outside of a contracted engagement with <strong>{FIRM_NAME}</strong> does so without authorization and may be subject to legal action.
        </p>
      </div>
    </div>
  );
}

function SignatureBlock() {
  return (
    <div className="mt-8 pt-6 border-t border-gray-200 grid grid-cols-2 gap-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">Service Provider</p>
        <div className="border-b border-gray-400 mb-1 h-8" />
        <p className="text-xs text-gray-500">{PARALEGAL_NAME}, {PARALEGAL_TITLE}</p>
        <div className="border-b border-gray-300 mb-1 h-6 mt-3" />
        <p className="text-xs text-gray-400">Date</p>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">Client</p>
        <div className="border-b border-gray-400 mb-1 h-8" />
        <p className="text-xs text-gray-500">Printed Name &amp; Title</p>
        <div className="border-b border-gray-300 mb-1 h-6 mt-3" />
        <p className="text-xs text-gray-400">Date</p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="font-semibold text-sm uppercase tracking-wider mb-2" style={{ color: '#355E3B' }}>{title}</h3>
      <div className="text-sm text-gray-700 leading-relaxed space-y-1">{children}</div>
    </div>
  );
}

// ── 1. Contract of Services ────────────────────────────────────────────────────
function ContractOfServices() {
  return (
    <DocumentWrapper>
      <ContractHeader title="Contract of Services" subtitle="Freelance Paralegal Services Agreement" />
      <Section title="1. Parties">
        <p>This Contract of Services ("Agreement") is entered into between <strong>{FIRM_NAME}</strong> — represented by <strong>{PARALEGAL_NAME}</strong>, Freelance Paralegal ("Service Provider") — and the undersigned client ("Client"). The Client is in contract with <strong>{FIRM_NAME}</strong> for the services described herein.</p>
      </Section>
      <Section title="2. Scope of Services">
        <p>Service Provider agrees to perform paralegal services as described in the attached Statement of Work or as mutually agreed in writing. Services may include document preparation, legal research, case organization, and administrative support. For a full list of available services and pricing, visit: <strong>{PRICING_URL}</strong></p>
      </Section>
      <Section title="3. Fees & Payment">
        <p>Client agrees to pay fees as outlined on the Pricing Page at <strong>{PRICING_URL}</strong>. A retainer may be required prior to commencement of services. Invoices are due within 14 days of issuance unless otherwise agreed.</p>
      </Section>
      <Section title="4. Independent Contractor">
        <p>Service Provider is an independent contractor and not an employee of Client. Nothing in this Agreement creates a partnership, joint venture, or employment relationship.</p>
      </Section>
      <Section title="5. Confidentiality">
        <p>Both parties agree to maintain strict confidentiality regarding all information exchanged in connection with this Agreement. Service Provider shall not disclose Client information to third parties without prior written consent.</p>
      </Section>
      <Section title="6. Limitation of Liability">
        <p>Service Provider is not an attorney and does not provide legal advice. All work product is for informational and organizational purposes only. Client is responsible for having all documents reviewed by a licensed attorney before use.</p>
      </Section>
      <Section title="7. Termination">
        <p>Either party may terminate this Agreement with 7 days written notice. Client is responsible for fees incurred up to the date of termination.</p>
      </Section>
      <Section title="8. Governing Law">
        <p>This Agreement shall be governed by the laws of the State of Louisiana.</p>
      </Section>
      <SignatureBlock />
      <ProprietaryNotice />
    </DocumentWrapper>
  );
}

// ── 2. Retainer Contract ───────────────────────────────────────────────────────
function RetainerContractDoc() {
  return (
    <DocumentWrapper>
      <ContractHeader title="Retainer Contract" subtitle="Monthly Retainer Agreement for Paralegal Services" />
      <Section title="1. Parties">
        <p>This Retainer Agreement is entered into between <strong>{FIRM_NAME}</strong> — represented by <strong>{PARALEGAL_NAME}</strong>, Freelance Paralegal ("Service Provider") — and the undersigned client ("Client"). The Client is in contract with <strong>{FIRM_NAME}</strong> for monthly retainer paralegal services as described herein.</p>
      </Section>
      <Section title="2. Retainer Fee">
        <p>Client agrees to pay a monthly retainer fee as selected from the available plans at <strong>{PRICING_URL}</strong>. The retainer secures a designated number of hours per month for paralegal services.</p>
      </Section>
      <Section title="3. Included Hours">
        <p>Retainer hours are as follows (see Pricing Page for current rates):</p>
        <ul className="list-disc pl-5 mt-1 space-y-0.5">
          <li>Starter Plan: 10 hours/month</li>
          <li>Professional Plan: 20 hours/month</li>
          <li>Enterprise Plan: 40 hours/month</li>
        </ul>
        <p className="mt-1">Unused hours do not roll over unless otherwise agreed in writing.</p>
      </Section>
      <Section title="4. Overage">
        <p>Hours exceeding the retainer amount will be billed at the standard hourly rate listed at <strong>{PRICING_URL}</strong>. Client will be notified before overage hours are incurred.</p>
      </Section>
      <Section title="5. Billing Cycle">
        <p>Retainer fees are billed on the 1st of each month. Payment is due within 5 business days. Failure to pay may result in suspension of services.</p>
      </Section>
      <Section title="6. Scope of Retainer Services">
        <p>Retainer covers document preparation, legal research, case management support, correspondence drafting, and other agreed paralegal tasks. Specific deliverables are defined in the Statement of Work.</p>
      </Section>
      <Section title="7. Term & Renewal">
        <p>This Agreement commences on the Effective Date and renews monthly unless either party provides 30 days written notice of cancellation.</p>
      </Section>
      <Section title="8. Confidentiality & Non-Disclosure">
        <p>All client information, case details, and communications are strictly confidential. Service Provider will not disclose any information without written consent.</p>
      </Section>
      <Section title="9. Limitation of Liability">
        <p>Service Provider is not a licensed attorney. All work product must be reviewed by supervising counsel before filing or use in legal proceedings.</p>
      </Section>
      <SignatureBlock />
      <ProprietaryNotice />
    </DocumentWrapper>
  );
}

// ── 3. Intake Invoice Form ─────────────────────────────────────────────────────
function IntakeInvoiceForm() {
  return (
    <DocumentWrapper>
      <ContractHeader title="Intake Invoice Form" subtitle="Client Intake & Initial Invoice" />
      <Section title="Parties">
        <p>The undersigned Client is in contract with <strong>{FIRM_NAME}</strong> ({PARALEGAL_NAME}, Freelance Paralegal) for the services selected below.</p>
      </Section>
      <Section title="Client Information">
        <div className="grid grid-cols-2 gap-4">
          {['Full Name', 'Company / Firm Name', 'Email Address', 'Phone Number', 'Mailing Address', 'City, State, ZIP'].map(f => (
            <div key={f}>
              <p className="text-xs text-gray-500 mb-0.5">{f}</p>
              <div className="border-b border-gray-300 h-6" />
            </div>
          ))}
        </div>
      </Section>
      <Section title="Matter Information">
        <div className="grid grid-cols-2 gap-4">
          {['Case / Matter Name', 'Case Number (if applicable)', 'Court / Jurisdiction', 'Opposing Party'].map(f => (
            <div key={f}>
              <p className="text-xs text-gray-500 mb-0.5">{f}</p>
              <div className="border-b border-gray-300 h-6" />
            </div>
          ))}
        </div>
        <div className="mt-3">
          <p className="text-xs text-gray-500 mb-0.5">Brief Description of Services Needed</p>
          <div className="border border-gray-200 rounded h-16" />
        </div>
      </Section>
      <Section title="Services Selected">
        <p className="text-xs text-gray-500 mb-2">See full pricing at: <strong>{PRICING_URL}</strong></p>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-gray-200 p-2 text-left">Service</th>
              <th className="border border-gray-200 p-2 text-left">Hours Est.</th>
              <th className="border border-gray-200 p-2 text-left">Rate</th>
              <th className="border border-gray-200 p-2 text-left">Total</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3].map(i => (
              <tr key={i}>
                <td className="border border-gray-200 p-2 h-7" />
                <td className="border border-gray-200 p-2 h-7" />
                <td className="border border-gray-200 p-2 h-7" />
                <td className="border border-gray-200 p-2 h-7" />
              </tr>
            ))}
            <tr className="bg-gray-50 font-semibold">
              <td colSpan={3} className="border border-gray-200 p-2 text-right">Total Due</td>
              <td className="border border-gray-200 p-2" />
            </tr>
          </tbody>
        </table>
      </Section>
      <Section title="Payment Terms">
        <p>Payment is due upon receipt. Retainer required before work begins. Pay online at: <strong>{PRICING_URL}</strong></p>
      </Section>
      <SignatureBlock />
      <ProprietaryNotice />
    </DocumentWrapper>
  );
}

// ── 4. NDA ─────────────────────────────────────────────────────────────────────
function NDAForm() {
  return (
    <DocumentWrapper>
      <ContractHeader title="Non-Disclosure Agreement (NDA)" subtitle="Mutual Confidentiality Agreement" />
      <Section title="1. Parties">
        <p>This Non-Disclosure Agreement ("Agreement") is entered into between <strong>{FIRM_NAME}</strong> — represented by <strong>{PARALEGAL_NAME}</strong> ("Disclosing Party") — and the undersigned Client ("Receiving Party"), collectively the "Parties." The Client is in contract with <strong>{FIRM_NAME}</strong> and agrees to the confidentiality obligations set forth herein.</p>
      </Section>
      <Section title="2. Definition of Confidential Information">
        <p>"Confidential Information" means any non-public information disclosed by either party, including but not limited to: client data, case strategies, legal documents, financial information, business processes, and any information marked as confidential or that a reasonable person would consider confidential.</p>
      </Section>
      <Section title="3. Obligations of Receiving Party">
        <p>The Receiving Party agrees to: (a) hold all Confidential Information in strict confidence; (b) not disclose Confidential Information to any third party without prior written consent; (c) use Confidential Information solely for the purpose of the engagement described herein; (d) protect Confidential Information with at least the same degree of care used to protect its own confidential information.</p>
      </Section>
      <Section title="4. Exclusions">
        <p>Confidentiality obligations do not apply to information that: (a) is or becomes publicly known through no breach of this Agreement; (b) was rightfully known before disclosure; (c) is independently developed without use of Confidential Information; (d) is required to be disclosed by law or court order.</p>
      </Section>
      <Section title="5. Term">
        <p>This Agreement shall remain in effect for a period of three (3) years from the Effective Date, or for the duration of the engagement plus two (2) years, whichever is longer.</p>
      </Section>
      <Section title="6. Return of Information">
        <p>Upon request or termination of the engagement, the Receiving Party shall promptly return or destroy all Confidential Information and certify such destruction in writing.</p>
      </Section>
      <Section title="7. Remedies">
        <p>The Parties acknowledge that breach of this Agreement may cause irreparable harm for which monetary damages would be inadequate, and that injunctive relief may be sought without bond.</p>
      </Section>
      <Section title="8. Governing Law">
        <p>This Agreement shall be governed by the laws of the State of Louisiana.</p>
      </Section>
      <SignatureBlock />
      <ProprietaryNotice />
    </DocumentWrapper>
  );
}

// ── 5. Privacy Revocation Form ─────────────────────────────────────────────────
function PrivacyRevocationForm() {
  return (
    <DocumentWrapper>
      <ContractHeader title="Privacy Revocation Form" subtitle="Revocation of Authorization to Use / Disclose Personal Information" />
      <Section title="Client Information">
        <div className="grid grid-cols-2 gap-4">
          {['Full Legal Name', 'Date of Birth', 'Email Address', 'Phone Number', 'Mailing Address', 'Case / Matter Number'].map(f => (
            <div key={f}>
              <p className="text-xs text-gray-500 mb-0.5">{f}</p>
              <div className="border-b border-gray-300 h-6" />
            </div>
          ))}
        </div>
      </Section>
      <Section title="Revocation Details">
        <p>I, the undersigned, hereby revoke any and all prior authorizations granted to <strong>{PARALEGAL_NAME}</strong> / Broussard Legal Services to use, disclose, or share my personal information, including but not limited to:</p>
        <div className="mt-2 space-y-1">
          {['Medical records', 'Financial records', 'Legal case information', 'Contact information for marketing purposes', 'Other (specify below)'].map(item => (
            <label key={item} className="flex items-center gap-2 text-xs">
              <span className="w-4 h-4 border border-gray-400 rounded inline-block flex-shrink-0" />
              {item}
            </label>
          ))}
        </div>
        <div className="mt-3">
          <p className="text-xs text-gray-500 mb-0.5">Specify Other / Additional Details</p>
          <div className="border border-gray-200 rounded h-12" />
        </div>
      </Section>
      <Section title="Scope of Revocation">
        <p>This revocation is effective immediately upon receipt and applies to all future uses and disclosures. It does not apply retroactively to disclosures already made in reliance on a prior authorization.</p>
      </Section>
      <Section title="Acknowledgment">
        <p>I understand that revoking this authorization may affect the ability of Broussard Legal Services to provide certain services. I have been informed of the consequences of this revocation.</p>
      </Section>
      <SignatureBlock />
      <ProprietaryNotice />
    </DocumentWrapper>
  );
}

// ── 6. Confidentiality Agreement ───────────────────────────────────────────────
function ConfidentialityAgreement() {
  return (
    <DocumentWrapper>
      <ContractHeader title="Confidentiality Agreement Contract" subtitle="Professional Confidentiality & Non-Disclosure Contract" />
      <Section title="1. Purpose">
        <p>This Confidentiality Agreement ("Agreement") is designed to protect sensitive information shared between <strong>{FIRM_NAME}</strong> — represented by <strong>{PARALEGAL_NAME}</strong>, Freelance Paralegal — and Client in connection with the provision of paralegal services. The Client is in contract with <strong>{FIRM_NAME}</strong> and agrees to the obligations set forth herein.</p>
      </Section>
      <Section title="2. Scope of Confidential Information">
        <p>All information shared in connection with legal matters, including but not limited to: case facts, legal strategies, client identities, opposing party information, settlement discussions, financial data, and any documents prepared or reviewed, shall be considered strictly confidential.</p>
      </Section>
      <Section title="3. Duty of Confidentiality">
        <p>Service Provider agrees to: maintain all client information in strict confidence; not discuss case details with unauthorized persons; store all documents securely; use client information only for the purpose of providing agreed services; comply with all applicable privacy laws and professional standards.</p>
      </Section>
      <Section title="4. Client Obligations">
        <p>Client agrees to: not share work product prepared by Service Provider with unauthorized third parties without consent; notify Service Provider immediately of any suspected breach; use all deliverables only for lawful purposes.</p>
      </Section>
      <Section title="5. Duration">
        <p>This Agreement remains in effect indefinitely following termination of the service relationship with respect to information disclosed during the engagement.</p>
      </Section>
      <Section title="6. Exceptions">
        <p>Disclosure is permitted when: required by court order or subpoena (with prompt notice to Client); required by law; necessary to prevent imminent harm; or with Client's prior written consent.</p>
      </Section>
      <Section title="7. Breach & Remedies">
        <p>Any breach of this Agreement may result in immediate termination of services and may give rise to legal action. Injunctive relief may be sought in addition to monetary damages.</p>
      </Section>
      <SignatureBlock />
      <ProprietaryNotice />
    </DocumentWrapper>
  );
}

// ── 7. Document Drafting Contract ──────────────────────────────────────────────
function DocumentDraftingContract() {
  return (
    <DocumentWrapper>
      <ContractHeader title="Document Drafting Contract" subtitle="Agreement for Paralegal Document Preparation Services" />
      <Section title="1. Parties">
        <p>This Document Drafting Contract is entered into between <strong>{FIRM_NAME}</strong> — represented by <strong>{PARALEGAL_NAME}</strong>, Freelance Paralegal ("Service Provider") — and the undersigned Client. The Client is in contract with <strong>{FIRM_NAME}</strong> for document preparation services as described herein.</p>
      </Section>
      <Section title="2. Services">
        <p>Service Provider agrees to draft, prepare, and/or organize the following documents as specified by Client. For pricing information, visit: <strong>{PRICING_URL}</strong></p>
        <div className="mt-2 border border-gray-200 rounded p-3">
          <p className="text-xs text-gray-500 mb-1">Documents to be Drafted (list all):</p>
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="border-b border-gray-200 h-6" />
            ))}
          </div>
        </div>
      </Section>
      <Section title="3. Turnaround Time">
        <p>Estimated completion: _________________ business days from receipt of all required information and materials. Rush fees may apply for expedited requests (see <strong>{PRICING_URL}</strong>).</p>
      </Section>
      <Section title="4. Client Responsibilities">
        <p>Client agrees to provide all necessary information, source documents, and instructions in a timely manner. Delays caused by Client's failure to provide materials may extend the turnaround time.</p>
      </Section>
      <Section title="5. Revisions">
        <p>This contract includes _____ round(s) of revisions. Additional revisions will be billed at the hourly rate listed at <strong>{PRICING_URL}</strong>.</p>
      </Section>
      <Section title="6. Disclaimer">
        <p>All documents prepared by Service Provider are for informational and organizational purposes only and do not constitute legal advice. Client is responsible for having all documents reviewed by a licensed attorney before filing or use.</p>
      </Section>
      <Section title="7. Ownership">
        <p>Upon full payment, Client owns all work product prepared under this Agreement. Service Provider retains no rights to use Client's documents.</p>
      </Section>
      <Section title="8. Payment">
        <p>Fees are as agreed per the Pricing Page at <strong>{PRICING_URL}</strong>. A deposit of 50% is required before work begins. Remaining balance is due upon delivery.</p>
      </Section>
      <SignatureBlock />
      <ProprietaryNotice />
    </DocumentWrapper>
  );
}

// ── 8. Deposition Contract (Sliding Scale) ────────────────────────────────────
function DepositionContract() {
  return (
    <DocumentWrapper>
      <ContractHeader title="Deposition Support Contract" subtitle="Sliding Scale Fee Agreement for Deposition Preparation Services" />
      <Section title="1. Parties">
        <p>This Deposition Support Contract is entered into between <strong>{FIRM_NAME}</strong> — represented by <strong>{PARALEGAL_NAME}</strong>, Freelance Paralegal ("Service Provider") — and the undersigned Client. The Client is in contract with <strong>{FIRM_NAME}</strong> for deposition preparation services as described herein.</p>
      </Section>
      <Section title="2. Services Included">
        <p>Service Provider will provide deposition support services as selected below. Fees are based on the scale and complexity of services required. For full pricing, visit: <strong>{PRICING_URL}</strong></p>
      </Section>
      <Section title="3. Sliding Scale Fee Structure">
        <table className="w-full text-xs border-collapse mt-1">
          <thead>
            <tr style={{ background: '#355E3B', color: 'white' }}>
              <th className="p-2 text-left">Service Tier</th>
              <th className="p-2 text-left">Scope</th>
              <th className="p-2 text-left">Rate</th>
              <th className="p-2 text-left">Selected</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Basic', 'Deposition outline & witness list', '$150–$250'],
              ['Standard', 'Full prep package + exhibit index', '$300–$500'],
              ['Comprehensive', 'Full prep + timeline + discovery cross-ref', '$600–$900'],
              ['Complex Litigation', 'Multi-party, expert witnesses, full support', 'Custom Quote'],
            ].map(([tier, scope, rate]) => (
              <tr key={tier} className="border-b border-gray-100">
                <td className="p-2 font-medium">{tier}</td>
                <td className="p-2 text-gray-600">{scope}</td>
                <td className="p-2" style={{ color: '#C8965A' }}>{rate}</td>
                <td className="p-2"><span className="w-4 h-4 border border-gray-400 rounded inline-block" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
      <Section title="4. Deliverables">
        <p>Depending on tier selected, deliverables may include: deposition outline, witness preparation notes, exhibit index, deposition preparation timeline, discovery cross-reference, and summary of key issues.</p>
      </Section>
      <Section title="5. Timeline">
        <p>Work will commence upon receipt of retainer payment and all required case materials. Estimated delivery: _________________ business days.</p>
      </Section>
      <Section title="6. Disclaimer">
        <p>Service Provider is not a licensed attorney. All deposition preparation materials must be reviewed by supervising counsel before use. Service Provider does not attend depositions unless separately arranged.</p>
      </Section>
      <Section title="7. Payment">
        <p>50% deposit required to begin. Balance due upon delivery. Custom quotes require written approval before work begins. See <strong>{PRICING_URL}</strong> for current rates.</p>
      </Section>
      <SignatureBlock />
      <ProprietaryNotice />
    </DocumentWrapper>
  );
}

// ── 9. Pre-Litigation Document Checklist ──────────────────────────────────────
function PreLitigationChecklist() {
  return (
    <DocumentWrapper>
      <ContractHeader title="Pre-Litigation Document Checklist" subtitle="Essential Documents to Gather Before Filing" />
      <p className="text-xs text-gray-500 mb-2">Prepared by <strong>{FIRM_NAME}</strong> for client use in connection with an active engagement. For assistance gathering or organizing these documents, visit: <strong>{PRICING_URL}</strong></p>
      {[
        {
          cat: 'Client & Party Information',
          items: ['Government-issued ID for all parties', 'Contact information for all parties', 'Corporate entity documents (if applicable)', 'Power of attorney (if applicable)'],
        },
        {
          cat: 'Contracts & Agreements',
          items: ['All relevant contracts and amendments', 'Correspondence related to the dispute', 'Invoices and payment records', 'Warranties or guarantees'],
        },
        {
          cat: 'Evidence & Documentation',
          items: ['Photographs or videos related to the matter', 'Medical records (personal injury matters)', 'Police or incident reports', 'Expert reports or opinions', 'Witness contact information and statements'],
        },
        {
          cat: 'Financial Records',
          items: ['Bank statements (relevant period)', 'Tax returns (if financial damages claimed)', 'Proof of losses or damages', 'Insurance policies and claims'],
        },
        {
          cat: 'Prior Legal Proceedings',
          items: ['Prior court orders or judgments', 'Prior settlement agreements', 'Arbitration awards', 'Bankruptcy filings (if applicable)'],
        },
        {
          cat: 'Deadlines & Statutes of Limitations',
          items: ['Statute of limitations deadline confirmed', 'Filing deadlines calendared', 'Notice requirements met', 'Demand letter sent (if required)'],
        },
      ].map(({ cat, items }) => (
        <div key={cat} className="mb-4">
          <h3 className="font-semibold text-xs uppercase tracking-wider mb-2" style={{ color: '#355E3B' }}>{cat}</h3>
          <div className="space-y-1.5">
            {items.map(item => (
              <label key={item} className="flex items-start gap-2 text-xs text-gray-700">
                <span className="w-4 h-4 border border-gray-400 rounded flex-shrink-0 mt-0.5" />
                {item}
              </label>
            ))}
          </div>
        </div>
      ))}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">Prepared by: _________________ &nbsp;|&nbsp; Date: _________________ &nbsp;|&nbsp; Matter: _________________</p>
      </div>
    </DocumentWrapper>
  );
}

// ── 10. Contract Review Red-Flag Triggers ─────────────────────────────────────
function ContractReviewRedFlags() {
  return (
    <DocumentWrapper>
      <ContractHeader title="Contract Review Red-Flag Triggers" subtitle="Key Issues to Identify During Contract Review" />
      <p className="text-xs text-gray-500 mb-2">Prepared by <strong>{FIRM_NAME}</strong> for client use in connection with an active engagement. Flag any items marked below for attorney review. For contract review services, visit: <strong>{PRICING_URL}</strong></p>
      {[
        {
          cat: 'Parties & Authority',
          flags: ['Incorrect or incomplete party names', 'Signatory lacks authority to bind entity', 'Missing corporate authorization', 'Undisclosed principals or agents'],
        },
        {
          cat: 'Payment & Financial Terms',
          flags: ['Vague or undefined payment terms', 'Automatic renewal with price increases', 'Penalty clauses without caps', 'Hidden fees or charges', 'No late payment grace period'],
        },
        {
          cat: 'Scope & Deliverables',
          flags: ['Undefined or overly broad scope of work', 'No change order process', 'Unrealistic timelines without force majeure', 'Missing acceptance criteria'],
        },
        {
          cat: 'Liability & Indemnification',
          flags: ['Unlimited liability clauses', 'One-sided indemnification', 'Missing insurance requirements', 'Waiver of consequential damages (unfavorable)', 'Personal guarantees'],
        },
        {
          cat: 'Termination & Exit',
          flags: ['No termination for convenience clause', 'Excessive termination penalties', 'Unclear notice requirements', 'IP ownership reverts on termination'],
        },
        {
          cat: 'Dispute Resolution',
          flags: ['Mandatory arbitration in unfavorable jurisdiction', 'Waiver of jury trial', 'Shortened statute of limitations', 'No mediation step before arbitration'],
        },
        {
          cat: 'Confidentiality & IP',
          flags: ['Overly broad IP assignment', 'No carve-out for pre-existing IP', 'Missing data protection provisions', 'Perpetual confidentiality obligations'],
        },
      ].map(({ cat, flags }) => (
        <div key={cat} className="mb-4">
          <h3 className="font-semibold text-xs uppercase tracking-wider mb-2" style={{ color: '#C8965A' }}>{cat}</h3>
          <div className="space-y-1.5">
            {flags.map(flag => (
              <label key={flag} className="flex items-start gap-2 text-xs text-gray-700">
                <span className="w-4 h-4 border border-red-300 rounded flex-shrink-0 mt-0.5 bg-red-50" />
                {flag}
              </label>
            ))}
          </div>
        </div>
      ))}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">Reviewer: _________________ &nbsp;|&nbsp; Date: _________________ &nbsp;|&nbsp; Contract: _________________</p>
        <p className="text-xs text-gray-400 mt-1">⚠ This checklist is for organizational purposes only. All flagged items require review by a licensed attorney.</p>
      </div>
    </DocumentWrapper>
  );
}

// ── 11. Deposition Preparation Timeline ───────────────────────────────────────
function DepositionPrepTimeline() {
  return (
    <DocumentWrapper>
      <ContractHeader title="Deposition Preparation Timeline" subtitle="Step-by-Step Preparation Schedule" />
      <p className="text-xs text-gray-500 mb-2">Prepared by <strong>{FIRM_NAME}</strong> for client use in connection with an active engagement.</p>
      <p className="text-xs text-gray-500 mb-4">Deposition Date: _________________ &nbsp;|&nbsp; Witness: _________________ &nbsp;|&nbsp; Matter: _________________</p>
      <p className="text-xs text-gray-500 mb-4">For deposition preparation services, visit: <strong>{PRICING_URL}</strong></p>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr style={{ background: '#355E3B', color: 'white' }}>
            <th className="p-2 text-left w-28">Timeframe</th>
            <th className="p-2 text-left">Task</th>
            <th className="p-2 text-left w-24">Assigned To</th>
            <th className="p-2 text-left w-20">Done</th>
          </tr>
        </thead>
        <tbody>
          {[
            ['4+ Weeks Out', 'Confirm deposition date, time, location, and court reporter'],
            ['4+ Weeks Out', 'Gather and organize all relevant documents and exhibits'],
            ['4+ Weeks Out', 'Review prior deposition transcripts (if any)'],
            ['3 Weeks Out', 'Draft deposition outline and key question areas'],
            ['3 Weeks Out', 'Identify and index all exhibits to be used'],
            ['3 Weeks Out', 'Research witness background and prior statements'],
            ['2 Weeks Out', 'Prepare witness for deposition (with supervising attorney)'],
            ['2 Weeks Out', 'Finalize exhibit binders and copies'],
            ['2 Weeks Out', 'Cross-reference discovery responses with deposition topics'],
            ['1 Week Out', 'Confirm logistics (location, court reporter, video)'],
            ['1 Week Out', 'Final review of outline and exhibits with attorney'],
            ['1 Week Out', 'Prepare summary of key issues and anticipated objections'],
            ['Day Before', 'Confirm all parties and confirm court reporter'],
            ['Day Before', 'Final witness preparation session'],
            ['Day Of', 'Arrive early, set up exhibits, confirm recording'],
            ['Post-Deposition', 'Order transcript, summarize key testimony, update case file'],
          ].map(([time, task]) => (
            <tr key={task} className="border-b border-gray-100">
              <td className="p-2 font-medium text-gray-600 whitespace-nowrap">{time}</td>
              <td className="p-2 text-gray-700">{task}</td>
              <td className="p-2"><div className="border-b border-gray-300 h-4" /></td>
              <td className="p-2"><span className="w-4 h-4 border border-gray-400 rounded inline-block" /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-400">Prepared by: _________________ &nbsp;|&nbsp; Date: _________________</p>
      </div>
    </DocumentWrapper>
  );
}

// ── 12. Discovery Request Tracking Template ───────────────────────────────────
function DiscoveryTrackingTemplate() {
  return (
    <DocumentWrapper>
      <ContractHeader title="Discovery Request Tracking Template" subtitle="Organize and Monitor All Discovery Obligations" />
      <p className="text-xs text-gray-500 mb-2">Prepared by <strong>{FIRM_NAME}</strong> for client use in connection with an active engagement.</p>
      <p className="text-xs text-gray-500 mb-4">Matter: _________________ &nbsp;|&nbsp; Case No.: _________________ &nbsp;|&nbsp; Prepared by: _________________</p>
      <p className="text-xs text-gray-500 mb-4">For discovery support services, visit: <strong>{PRICING_URL}</strong></p>
      {[
        { type: 'Interrogatories', cols: ['No.', 'Propounded By', 'Date Served', 'Response Due', 'Date Responded', 'Status', 'Notes'] },
        { type: 'Requests for Production (RFP)', cols: ['No.', 'Propounded By', 'Date Served', 'Response Due', 'Docs Produced', 'Status', 'Notes'] },
        { type: 'Requests for Admission (RFA)', cols: ['No.', 'Propounded By', 'Date Served', 'Response Due', 'Admitted/Denied', 'Status', 'Notes'] },
        { type: 'Depositions', cols: ['Witness', 'Party', 'Date Noticed', 'Depo Date', 'Transcript Ordered', 'Summary Done', 'Notes'] },
        { type: 'Subpoenas', cols: ['Recipient', 'Type', 'Date Issued', 'Return Date', 'Docs Received', 'Status', 'Notes'] },
      ].map(({ type, cols }) => (
        <div key={type} className="mb-6">
          <h3 className="font-semibold text-xs uppercase tracking-wider mb-2" style={{ color: '#355E3B' }}>{type}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  {cols.map(c => <th key={c} className="border border-gray-200 p-1.5 text-left whitespace-nowrap">{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3].map(i => (
                  <tr key={i}>
                    {cols.map(c => <td key={c} className="border border-gray-200 p-1.5 h-7" />)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </DocumentWrapper>
  );
}

// ── 13. Client Intake Essentials List ─────────────────────────────────────────
function ClientIntakeEssentialsList() {
  return (
    <DocumentWrapper>
      <ContractHeader title="Client Intake Essentials List" subtitle="Information & Documents Required at Intake" />
      <p className="text-xs text-gray-500 mb-2">Prepared by <strong>{FIRM_NAME}</strong> for client use in connection with an active engagement. For intake services, visit: <strong>{PRICING_URL}</strong></p>
      {[
        {
          cat: 'Personal / Entity Information',
          items: ['Full legal name (as it appears on government ID)', 'Date of birth / Date of incorporation', 'Social Security Number or EIN (if required)', 'Current mailing address', 'Primary phone number', 'Email address', 'Preferred contact method'],
        },
        {
          cat: 'Matter Details',
          items: ['Type of legal matter (civil, family, business, etc.)', 'Brief description of the issue', 'Date the issue arose', 'Statute of limitations deadline (if applicable)', 'Prior legal proceedings related to this matter', 'Opposing party name and contact info (if known)'],
        },
        {
          cat: 'Documents to Collect at Intake',
          items: ['Government-issued photo ID', 'Relevant contracts or agreements', 'Correspondence (emails, letters, texts)', 'Financial records (if relevant)', 'Court documents (if prior proceedings)', 'Insurance information (if applicable)', 'Medical records (personal injury matters)', 'Business records (business disputes)'],
        },
        {
          cat: 'Conflict Check',
          items: ['Confirm no conflict of interest with existing clients', 'Confirm no conflict with opposing parties', 'Document conflict check completion date and result'],
        },
        {
          cat: 'Engagement Setup',
          items: ['Retainer agreement signed', 'Initial retainer payment received', 'Client portal access set up', 'Matter opened in case management system', 'Intake form completed and filed', 'Welcome email / onboarding packet sent'],
        },
      ].map(({ cat, items }) => (
        <div key={cat} className="mb-4">
          <h3 className="font-semibold text-xs uppercase tracking-wider mb-2" style={{ color: '#355E3B' }}>{cat}</h3>
          <div className="space-y-1.5">
            {items.map(item => (
              <label key={item} className="flex items-start gap-2 text-xs text-gray-700">
                <span className="w-4 h-4 border border-gray-400 rounded flex-shrink-0 mt-0.5" />
                {item}
              </label>
            ))}
          </div>
        </div>
      ))}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">Intake completed by: _________________ &nbsp;|&nbsp; Date: _________________ &nbsp;|&nbsp; Matter No.: _________________</p>
      </div>
    </DocumentWrapper>
  );
}

// ── 14. Billing & Retainer Agreement Checklist ────────────────────────────────
function BillingRetainerChecklist() {
  return (
    <DocumentWrapper>
      <ContractHeader title="Billing & Retainer Agreement Checklist" subtitle="Ensure All Billing Terms Are Clear Before Engagement Begins" />
      <p className="text-xs text-gray-500 mb-2">Prepared by <strong>{FIRM_NAME}</strong> for client use in connection with an active engagement. For current rates and retainer plans, visit: <strong>{PRICING_URL}</strong></p>
      {[
        {
          cat: 'Retainer Setup',
          items: ['Retainer amount agreed upon and documented', 'Retainer payment received and deposited', 'Retainer agreement signed by both parties', 'Retainer plan selected (Starter / Professional / Enterprise — see pricing page)', 'Retainer renewal terms explained to client'],
        },
        {
          cat: 'Fee Structure',
          items: ['Hourly rate or flat fee confirmed in writing', 'Scope of included services clearly defined', 'Overage rate agreed upon', 'Rush fee policy explained', 'Expense reimbursement policy documented'],
        },
        {
          cat: 'Invoicing',
          items: ['Invoicing frequency agreed (weekly / bi-weekly / monthly)', 'Invoice delivery method confirmed (email / portal)', 'Payment due date established (e.g., Net 14)', 'Accepted payment methods communicated', 'Late payment policy explained'],
        },
        {
          cat: 'Time Tracking',
          items: ['Time tracking method established', 'Minimum billing increment agreed (e.g., 0.1 hr)', 'Time entries to be provided with each invoice', 'Client to receive monthly time summary'],
        },
        {
          cat: 'Billing Disputes',
          items: ['Dispute resolution process explained', 'Client has 7 days to dispute invoice items', 'Disputed amounts do not suspend undisputed work', 'Escalation process documented'],
        },
        {
          cat: 'Termination & Final Billing',
          items: ['Final invoice issued within 5 business days of termination', 'Unused retainer refunded within 14 days', 'Work product released upon full payment', 'Final accounting provided to client'],
        },
      ].map(({ cat, items }) => (
        <div key={cat} className="mb-4">
          <h3 className="font-semibold text-xs uppercase tracking-wider mb-2" style={{ color: '#355E3B' }}>{cat}</h3>
          <div className="space-y-1.5">
            {items.map(item => (
              <label key={item} className="flex items-start gap-2 text-xs text-gray-700">
                <span className="w-4 h-4 border border-gray-400 rounded flex-shrink-0 mt-0.5" />
                {item}
              </label>
            ))}
          </div>
        </div>
      ))}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">Reviewed by: _________________ &nbsp;|&nbsp; Date: _________________ &nbsp;|&nbsp; Client: _________________</p>
      </div>
      <SignatureBlock />
      <ProprietaryNotice />
    </DocumentWrapper>
  );
}

// ── 15. Discovery Management Contract ─────────────────────────────────────────
function DiscoveryManagementContract() {
  return (
    <DocumentWrapper>
      <ContractHeader title="Discovery Management Contract" subtitle="Agreement for Paralegal Discovery Management Services" />
      <Section title="1. Parties">
        <p>This Discovery Management Contract is entered into between <strong>{FIRM_NAME}</strong> — represented by <strong>{PARALEGAL_NAME}</strong>, Freelance Paralegal ("Service Provider") — and the undersigned Client. The Client is in contract with <strong>{FIRM_NAME}</strong> for discovery management services as described herein.</p>
      </Section>
      <Section title="2. Services">
        <p>Service Provider agrees to provide discovery management services as described herein. For a full list of available services and pricing, visit: <strong>{PRICING_URL}</strong></p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>Drafting and organizing discovery requests (interrogatories, RFPs, RFAs)</li>
          <li>Tracking discovery deadlines and response obligations</li>
          <li>Maintaining privilege logs and document indexes</li>
          <li>Bates-stamping and organizing produced documents</li>
          <li>Preparing discovery summaries and status reports</li>
          <li>Coordinating with opposing counsel on discovery disputes (under attorney supervision)</li>
        </ul>
      </Section>
      <Section title="3. Privilege Log">
        <p>Service Provider will maintain a privilege log identifying all documents withheld from production on grounds of attorney-client privilege or work product doctrine. The privilege log will include document type, date, author, recipient, and basis for privilege. All privilege determinations must be reviewed and approved by supervising counsel.</p>
      </Section>
      <Section title="4. Fees & Pricing">
        <p>Discovery management services are billed at the rates set forth on the Pricing Page at <strong>{PRICING_URL}</strong>. Retainer clients receive discovery management as part of their included hours. Standalone discovery projects are quoted based on volume and complexity.</p>
      </Section>
      <Section title="5. Turnaround & Deadlines">
        <p>Service Provider will use best efforts to meet all court-imposed discovery deadlines. Client is responsible for providing all necessary materials and instructions at least 5 business days before any deadline. Rush requests may incur additional fees (see <strong>{PRICING_URL}</strong>).</p>
      </Section>
      <Section title="6. Client Responsibilities">
        <p>Client agrees to: (a) provide all relevant documents and information promptly; (b) identify all potentially privileged documents; (c) have supervising counsel review all discovery responses before service; (d) notify Service Provider immediately of any court orders affecting discovery.</p>
      </Section>
      <Section title="7. Disclaimer">
        <p>Service Provider is not a licensed attorney. All discovery documents must be reviewed and signed by supervising counsel. Service Provider does not make legal determinations regarding privilege, relevance, or objections.</p>
      </Section>
      <Section title="8. Confidentiality">
        <p>All documents and information reviewed in connection with discovery management are strictly confidential. Service Provider will not disclose any case information to third parties without written consent.</p>
      </Section>
      <Section title="9. Governing Law">
        <p>This Agreement shall be governed by the laws of the State of Louisiana.</p>
      </Section>
      <SignatureBlock />
      <ProprietaryNotice />
    </DocumentWrapper>
  );
}

// ── 16. Legal Research & Memo Drafting Contract ────────────────────────────────
function LegalResearchMemoContract() {
  return (
    <DocumentWrapper>
      <ContractHeader title="Legal Research & Memo Drafting Contract" subtitle="Agreement for Paralegal Legal Research and Memorandum Services" />
      <Section title="1. Parties">
        <p>This Legal Research & Memo Drafting Contract is entered into between <strong>{FIRM_NAME}</strong> — represented by <strong>{PARALEGAL_NAME}</strong>, Freelance Paralegal ("Service Provider") — and the undersigned Client. The Client is in contract with <strong>{FIRM_NAME}</strong> for legal research and memorandum services as described herein.</p>
      </Section>
      <Section title="2. Services">
        <p>Service Provider agrees to perform legal research and memo drafting services as specified by Client. For pricing information, visit: <strong>{PRICING_URL}</strong></p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>Case law research (federal and state courts)</li>
          <li>Statutory and regulatory research</li>
          <li>Secondary source research (treatises, law reviews, practice guides)</li>
          <li>Drafting legal memoranda summarizing research findings</li>
          <li>Shepardizing / KeyCiting cases for current validity</li>
          <li>Jurisdiction-specific research as directed by supervising attorney</li>
        </ul>
      </Section>
      <Section title="3. Research Assignment">
        <div className="border border-gray-200 rounded p-3 mt-2">
          <p className="text-xs text-gray-500 mb-1">Research Issue / Question:</p>
          <div className="border-b border-gray-300 h-6 mb-2" />
          <p className="text-xs text-gray-500 mb-1">Jurisdiction(s):</p>
          <div className="border-b border-gray-300 h-6 mb-2" />
          <p className="text-xs text-gray-500 mb-1">Deadline:</p>
          <div className="border-b border-gray-300 h-6 mb-2" />
          <p className="text-xs text-gray-500 mb-1">Memo Format Required:</p>
          <div className="border-b border-gray-300 h-6" />
        </div>
      </Section>
      <Section title="4. Fees">
        <p>Legal research and memo drafting is billed at the hourly rate or flat fee as agreed and listed at <strong>{PRICING_URL}</strong>. Retainer clients receive research and memo drafting as part of their included hours. Estimated hours for this project: _________________</p>
      </Section>
      <Section title="5. Deliverables">
        <p>Service Provider will deliver: (a) a written legal memorandum summarizing research findings; (b) a list of key authorities (cases, statutes, regulations); (c) copies of key cases if requested. All deliverables will be provided in the format specified by Client.</p>
      </Section>
      <Section title="6. Disclaimer">
        <p>Service Provider is not a licensed attorney. All research memoranda are for informational and organizational purposes only and do not constitute legal advice. Supervising counsel must review all research before reliance or use in legal proceedings.</p>
      </Section>
      <Section title="7. Confidentiality">
        <p>All research assignments, case information, and work product are strictly confidential. Service Provider will not disclose any information to third parties without prior written consent.</p>
      </Section>
      <Section title="8. Ownership">
        <p>Upon full payment, Client owns all research memoranda and work product prepared under this Agreement. Service Provider retains no rights to use Client's work product.</p>
      </Section>
      <Section title="9. Governing Law">
        <p>This Agreement shall be governed by the laws of the State of Louisiana.</p>
      </Section>
      <SignatureBlock />
      <ProprietaryNotice />
    </DocumentWrapper>
  );
}

// ── 17. Motion & Brief Drafting Contract ──────────────────────────────────────
function MotionBriefDraftingContract() {
  return (
    <DocumentWrapper>
      <ContractHeader title="Motion & Brief Drafting Contract" subtitle="Agreement for Paralegal Motion and Brief Preparation Services" />
      <Section title="1. Parties">
        <p>This Motion & Brief Drafting Contract is entered into between <strong>{FIRM_NAME}</strong> — represented by <strong>{PARALEGAL_NAME}</strong>, Freelance Paralegal ("Service Provider") — and the undersigned Client. The Client is in contract with <strong>{FIRM_NAME}</strong> for motion and brief drafting services as described herein.</p>
      </Section>
      <Section title="2. Services">
        <p>Service Provider agrees to draft, prepare, and organize motions, briefs, and related court documents as specified by Client. For pricing information, visit: <strong>{PRICING_URL}</strong></p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>Drafting motions (motions to dismiss, summary judgment, in limine, etc.)</li>
          <li>Drafting supporting memoranda of law</li>
          <li>Drafting opposition and reply briefs</li>
          <li>Preparing tables of contents and tables of authorities</li>
          <li>Formatting briefs to court-specific rules and page limits</li>
          <li>Organizing and indexing exhibits and appendices</li>
          <li>Cite-checking and proofreading final drafts</li>
        </ul>
      </Section>
      <Section title="3. Document Details">
        <div className="border border-gray-200 rounded p-3 mt-2">
          <div className="grid grid-cols-2 gap-3">
            {['Document Title', 'Court / Jurisdiction', 'Filing Deadline', 'Page / Word Limit', 'Supervising Attorney', 'Estimated Hours'].map(f => (
              <div key={f}>
                <p className="text-xs text-gray-500 mb-0.5">{f}</p>
                <div className="border-b border-gray-300 h-6" />
              </div>
            ))}
          </div>
        </div>
      </Section>
      <Section title="4. Fees & Pricing">
        <p>Motion and brief drafting is billed at the rates set forth on the Pricing Page at <strong>{PRICING_URL}</strong>. Retainer clients (Standard and Full-Service plans) receive motion and brief drafting as part of their included hours. Standalone projects are quoted based on document type and complexity.</p>
        <table className="w-full text-xs border-collapse mt-2">
          <thead>
            <tr style={{ background: '#355E3B', color: 'white' }}>
              <th className="p-2 text-left">Document Type</th>
              <th className="p-2 text-left">Estimated Hours</th>
              <th className="p-2 text-left">Rate</th>
              <th className="p-2 text-left">Total Est.</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3].map(i => (
              <tr key={i} className="border-b border-gray-100">
                {[...Array(4)].map((_, j) => (
                  <td key={j} className="p-2 border border-gray-200 h-7" />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
      <Section title="5. Revisions">
        <p>This contract includes _____ round(s) of revisions. Additional revisions will be billed at the hourly rate listed at <strong>{PRICING_URL}</strong>. All revisions must be requested within 5 business days of delivery.</p>
      </Section>
      <Section title="6. Attorney Review Required">
        <p>All motions and briefs prepared by Service Provider must be reviewed, edited, and signed by supervising counsel before filing. Service Provider does not file documents with any court. Client and supervising counsel are solely responsible for all filing decisions.</p>
      </Section>
      <Section title="7. Disclaimer">
        <p>Service Provider is not a licensed attorney. All work product is for drafting assistance only and does not constitute legal advice. Client is responsible for ensuring all documents comply with applicable court rules and deadlines.</p>
      </Section>
      <Section title="8. Confidentiality">
        <p>All case information, legal strategies, and work product are strictly confidential. Service Provider will not disclose any information to third parties without prior written consent.</p>
      </Section>
      <Section title="9. Governing Law">
        <p>This Agreement shall be governed by the laws of the State of Louisiana.</p>
      </Section>
      <SignatureBlock />
      <ProprietaryNotice />
    </DocumentWrapper>
  );
}

// ── Document catalog ───────────────────────────────────────────────────────────
interface DocEntry {
  id: string;
  title: string;
  category: string;
  description: string;
  filename: string;
  Component: React.FC;
  badge?: string;
}

const DOCUMENTS: DocEntry[] = [
  {
    id: 'contract-of-services',
    title: 'Contract of Services',
    category: 'Contracts',
    description: 'General freelance paralegal services agreement covering scope, fees, confidentiality, and liability.',
    filename: 'BLS-Contract-of-Services.pdf',
    Component: ContractOfServices,
  },
  {
    id: 'retainer-contract',
    title: 'Retainer Contract',
    category: 'Contracts',
    description: 'Monthly retainer agreement with tiered hour plans, overage billing, and renewal terms.',
    filename: 'BLS-Retainer-Contract.pdf',
    badge: 'Popular',
    Component: RetainerContractDoc,
  },
  {
    id: 'discovery-management-contract',
    title: 'Discovery Management Contract',
    category: 'Contracts',
    description: 'Agreement for discovery management services — interrogatories, RFPs, privilege logs, and Bates stamping.',
    filename: 'BLS-Discovery-Management-Contract.pdf',
    badge: 'New',
    Component: DiscoveryManagementContract,
  },
  {
    id: 'legal-research-memo-contract',
    title: 'Legal Research & Memo Drafting Contract',
    category: 'Contracts',
    description: 'Agreement for legal research and memorandum drafting — case law, statutes, and jurisdiction-specific research.',
    filename: 'BLS-Legal-Research-Memo-Contract.pdf',
    badge: 'New',
    Component: LegalResearchMemoContract,
  },
  {
    id: 'motion-brief-drafting-contract',
    title: 'Motion & Brief Drafting Contract',
    category: 'Contracts',
    description: 'Agreement for motion and brief drafting — motions, memoranda, opposition briefs, and exhibit organization.',
    filename: 'BLS-Motion-Brief-Drafting-Contract.pdf',
    badge: 'New',
    Component: MotionBriefDraftingContract,
  },
  {
    id: 'intake-invoice',
    title: 'Intake Invoice Form',
    category: 'Forms',
    description: 'Client intake form combined with initial invoice — captures matter details and services selected.',
    filename: 'BLS-Intake-Invoice-Form.pdf',
    Component: IntakeInvoiceForm,
  },
  {
    id: 'nda',
    title: 'NDA Form',
    category: 'Agreements',
    description: 'Mutual non-disclosure agreement protecting confidential information shared during the engagement.',
    filename: 'BLS-NDA-Form.pdf',
    Component: NDAForm,
  },
  {
    id: 'privacy-revocation',
    title: 'Privacy Revocation Form',
    category: 'Forms',
    description: 'Formal revocation of authorization to use or disclose personal information.',
    filename: 'BLS-Privacy-Revocation-Form.pdf',
    Component: PrivacyRevocationForm,
  },
  {
    id: 'confidentiality-agreement',
    title: 'Confidentiality Agreement',
    category: 'Agreements',
    description: 'Professional confidentiality contract covering duties, exceptions, and breach remedies.',
    filename: 'BLS-Confidentiality-Agreement.pdf',
    Component: ConfidentialityAgreement,
  },
  {
    id: 'document-drafting',
    title: 'Document Drafting Contract',
    category: 'Contracts',
    description: 'Agreement for document preparation services including turnaround, revisions, and ownership.',
    filename: 'BLS-Document-Drafting-Contract.pdf',
    Component: DocumentDraftingContract,
  },
  {
    id: 'deposition-contract',
    title: 'Deposition Contract',
    category: 'Contracts',
    description: 'Sliding-scale fee agreement for deposition preparation — Basic through Complex Litigation tiers.',
    filename: 'BLS-Deposition-Contract.pdf',
    badge: 'Sliding Scale',
    Component: DepositionContract,
  },
  {
    id: 'pre-litigation-checklist',
    title: 'Pre-Litigation Document Checklist',
    category: 'Checklists',
    description: 'Comprehensive checklist of documents to gather before filing — parties, evidence, financials, deadlines.',
    filename: 'BLS-Pre-Litigation-Checklist.pdf',
    Component: PreLitigationChecklist,
  },
  {
    id: 'contract-review-red-flags',
    title: 'Contract Review Red-Flag Triggers',
    category: 'Checklists',
    description: 'Key red flags to identify during contract review — parties, payment, liability, IP, and more.',
    filename: 'BLS-Contract-Review-Red-Flags.pdf',
    Component: ContractReviewRedFlags,
  },
  {
    id: 'deposition-prep-timeline',
    title: 'Deposition Preparation Timeline',
    category: 'Checklists',
    description: 'Week-by-week preparation schedule from 4+ weeks out through post-deposition follow-up.',
    filename: 'BLS-Deposition-Prep-Timeline.pdf',
    Component: DepositionPrepTimeline,
  },
  {
    id: 'discovery-tracking',
    title: 'Discovery Request Tracking Template',
    category: 'Templates',
    description: 'Track interrogatories, RFPs, RFAs, depositions, and subpoenas with status and deadlines.',
    filename: 'BLS-Discovery-Tracking-Template.pdf',
    Component: DiscoveryTrackingTemplate,
  },
  {
    id: 'client-intake-essentials',
    title: 'Client Intake Essentials List',
    category: 'Checklists',
    description: 'Everything needed at intake — personal info, matter details, documents, conflict check, and setup.',
    filename: 'BLS-Client-Intake-Essentials.pdf',
    Component: ClientIntakeEssentialsList,
  },
  {
    id: 'billing-retainer-checklist',
    title: 'Billing & Retainer Agreement Checklist',
    category: 'Checklists',
    description: 'Ensure all billing terms are clear — retainer setup, fee structure, invoicing, and termination.',
    filename: 'BLS-Billing-Retainer-Checklist.pdf',
    Component: BillingRetainerChecklist,
  },
];

const CATEGORIES = ['All', 'Contracts', 'Agreements', 'Forms', 'Checklists', 'Templates'];

const CATEGORY_COLORS: Record<string, string> = {
  Contracts: '#355E3B',
  Agreements: '#C8965A',
  Forms: '#4a7c59',
  Checklists: '#8B6914',
  Templates: '#5a6e8a',
};

// ── Main page ──────────────────────────────────────────────────────────────────
export default function ContractsPage() {
  const [activeCategory, setActiveCategory] = useState('All');
  const [downloading, setDownloading] = useState<string | null>(null);
  const refs = useRef<Record<string, HTMLDivElement | null>>({});

  const filtered = activeCategory === 'All' ? DOCUMENTS : DOCUMENTS.filter(d => d.category === activeCategory);

  const handleDownload = async (doc: DocEntry) => {
    const el = refs.current[doc.id];
    if (!el) return;
    setDownloading(doc.id);
    try {
      await downloadAsPDF(el, doc.filename);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <>
      <Header />

      {/* Hero */}
      <section className="pt-32 pb-16 px-4" style={{ background: 'linear-gradient(135deg, #1a2e1a 0%, #2d4a2d 60%, #1a2e1a 100%)' }}>
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#C8965A' }}>Broussard Legal Services</p>
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-white mb-4">Contracts &amp; Templates</h1>
          <p className="text-base text-white/70 max-w-2xl mx-auto mb-8">
            Download, fill out, and upload any of the documents below. All contracts include embedded links to our{' '}
            <Link href="/pricing" className="underline underline-offset-2 hover:text-white transition-colors" style={{ color: '#C8965A' }}>
              Pricing Page
            </Link>{' '}
            for reference.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest transition-all duration-200 ${
                  activeCategory === cat
                    ? 'text-white' :'text-white/60 hover:text-white border border-white/20 hover:border-white/40'
                }`}
                style={activeCategory === cat ? { background: '#C8965A' } : {}}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Document Grid */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <p className="text-xs text-gray-400 mb-8 text-center">
            {filtered.length} document{filtered.length !== 1 ? 's' : ''} available
            {activeCategory !== 'All' ? ` in ${activeCategory}` : ''}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(doc => (
              <div
                key={doc.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col overflow-hidden"
              >
                {/* Card top accent */}
                <div className="h-1 w-full" style={{ background: CATEGORY_COLORS[doc.category] || '#355E3B' }} />

                <div className="p-6 flex flex-col flex-1">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-xs font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full"
                        style={{
                          background: `${CATEGORY_COLORS[doc.category]}18`,
                          color: CATEGORY_COLORS[doc.category] || '#355E3B',
                        }}
                      >
                        {doc.category}
                      </span>
                      {doc.badge && (
                        <span className="text-xs font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ background: '#C8965A18', color: '#C8965A' }}>
                          {doc.badge}
                        </span>
                      )}
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>

                  <h3 className="font-serif text-lg font-bold mb-2" style={{ color: '#1a2e1a' }}>{doc.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed flex-1 mb-4">{doc.description}</p>

                  <div className="flex items-center gap-2 mt-auto">
                    <button
                      onClick={() => handleDownload(doc)}
                      disabled={downloading === doc.id}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all duration-200 text-white disabled:opacity-60"
                      style={{ background: downloading === doc.id ? '#9ca3af' : '#355E3B' }}
                    >
                      {downloading === doc.id ? (
                        <>
                          <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                          </svg>
                          Generating…
                        </>
                      ) : (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                          Download PDF
                        </>
                      )}
                    </button>
                    <Link
                      href="/pricing"
                      className="flex items-center justify-center w-10 h-10 rounded-xl border transition-all duration-200 hover:border-opacity-80"
                      style={{ borderColor: '#C8965A40', color: '#C8965A', background: '#C8965A08' }}
                      title="View Pricing"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="1" x2="12" y2="23" />
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                      </svg>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-12 px-4" style={{ background: '#1a2e1a' }}>
        <div className="max-w-3xl mx-auto text-center">
          <p className="font-serif text-2xl font-bold text-white mb-3">Need a Custom Contract or Template?</p>
          <p className="text-sm text-white/60 mb-6">All documents can be customized to your specific matter. View service options and pricing, then book a consultation.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-xs font-semibold uppercase tracking-widest transition-all duration-200 text-white"
              style={{ background: '#C8965A' }}
            >
              View Pricing
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-xs font-semibold uppercase tracking-widest transition-all duration-200 border border-white/30 text-white hover:border-white/60"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </section>

      {/* Hidden render targets for PDF generation */}
      <div className="fixed -left-[9999px] top-0 pointer-events-none" aria-hidden="true">
        {DOCUMENTS.map(doc => (
          <div
            key={doc.id}
            ref={el => { refs.current[doc.id] = el; }}
          >
            <doc.Component />
          </div>
        ))}
      </div>

      <Footer />
    </>
  );
}
