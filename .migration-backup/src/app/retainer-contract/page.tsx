'use client';

import React, { useRef, useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Image from 'next/image';

// ── Contract data ──────────────────────────────────────────────────────────────
const CONTRACT_DATE = 'June 1, 2026';
const PARALEGAL_NAME = 'Maggi May Broussard';
const PARALEGAL_TITLE = 'Freelance Paralegal';
const PARALEGAL_EMAIL = 'broussardlegalservices@gmail.com';
const PARALEGAL_WEBSITE = 'https://broussardlegalservices.com';
const FIRM_NAME = 'Broussard Legal Services';

// ── PDF download helper ────────────────────────────────────────────────────────
async function downloadContractPDF(contractRef: React.RefObject<HTMLDivElement | null>) {
  if (!contractRef.current) return;

  const { default: jsPDF } = await import('jspdf');
  const { default: html2canvas } = await import('html2canvas');

  const element = contractRef.current;
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
    pdf.addImage(
      imgData,
      'PNG',
      margin,
      margin,
      contentWidth,
      imgHeight,
      undefined,
      'FAST',
      0,
      -yOffset
    );
    yOffset += sliceHeight;
    remainingHeight -= sliceHeight;
  }

  pdf.save('Maggi-May-Broussard-Retainer-Contract.pdf');
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function RetainerContractPage() {
  const contractRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadContractPDF(contractRef);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#FAF7F2] pt-28 pb-20">
        {/* ── Page header ── */}
        <section className="max-w-4xl mx-auto px-4 md:px-8 mb-10">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[#C8965A] mb-3">
                Legal Agreement
              </p>
              <h1 className="font-serif text-section-heading text-[#4A3728] leading-tight">
                Retainer Contract
              </h1>
              <p className="mt-3 text-[#7A6B5D] text-base max-w-lg">
                Review the full retainer agreement below. Download the PDF to sign, upload, or send by email.
              </p>
            </div>

            {/* Download button */}
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-[#355E3B] text-white text-sm font-semibold uppercase tracking-widest transition-all duration-300 hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed shrink-0 shadow-md"
            >
              {downloading ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Generating PDF…
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download PDF
                </>
              )}
            </button>
          </div>

          {/* Divider */}
          <div className="mt-8 h-px bg-gradient-to-r from-transparent via-[#C8965A]/40 to-transparent" />
        </section>

        {/* ── Contract document ── */}
        <section className="max-w-4xl mx-auto px-4 md:px-8">
          <div
            ref={contractRef}
            className="bg-white rounded-3xl shadow-[0_8px_48px_rgba(74,55,40,0.10)] overflow-hidden text-[#2C1F14]"
            style={{ fontFamily: 'Georgia, serif', lineHeight: '1.75' }}
          >
            {/* Letterhead image */}
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

            {/* Contract body */}
            <div className="p-10 md:p-16">
              {/* Contract header */}
              <div className="text-center mb-10 pb-8 border-b border-[#D9D0C5]">
                <p className="text-xs uppercase tracking-[0.2em] text-[#C8965A] mb-2">Freelance Paralegal Services</p>
                <h2 className="text-3xl font-bold text-[#4A3728] mb-1" style={{ fontFamily: 'Georgia, serif' }}>
                  Retainer Agreement
                </h2>
                <p className="text-sm text-[#7A6B5D]">Effective Date: {CONTRACT_DATE}</p>
              </div>

              {/* Parties */}
              <ContractSection title="1. Parties">
                <p>
                  This Retainer Agreement ("Agreement") is entered into as of <strong>{CONTRACT_DATE}</strong>, by and between:
                </p>
                <div className="mt-4 grid md:grid-cols-2 gap-6">
                  <PartyBox
                    label="Service Provider"
                    name={FIRM_NAME}
                    title={`${PARALEGAL_NAME} · ${PARALEGAL_TITLE}`}
                    email={PARALEGAL_EMAIL}
                    website={PARALEGAL_WEBSITE}
                  />
                  <PartyBox
                    label="Client"
                    name="[Client Full Name / Firm Name]"
                    title="[Title / Role]"
                    email="[Client Email]"
                    website="[Client Address]"
                  />
                </div>
                <p className="mt-4 text-sm">
                  The Client is in contract with <strong>{FIRM_NAME}</strong> for freelance paralegal services as described in this Agreement. This document is prepared by and for the exclusive use of <strong>{FIRM_NAME}</strong> and its clients.
                </p>
              </ContractSection>

              {/* Scope of Services */}
              <ContractSection title="2. Scope of Services">
                <p>
                  {PARALEGAL_NAME} agrees to provide freelance paralegal services to the Client on a retainer basis. Services may include, but are not limited to:
                </p>
                <ul className="mt-3 space-y-1.5 list-none pl-0">
                  {[
                    'Legal research and memoranda preparation',
                    'Drafting and reviewing pleadings, motions, and briefs',
                    'Discovery assistance — document review, production, and organization',
                    'Case management and file organization',
                    'Trial preparation support',
                    'Contract drafting and review',
                    'Client communication support (under attorney supervision)',
                    'Administrative and docketing tasks',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm">
                      <span className="mt-1 w-4 h-4 rounded-full bg-[#355E3B]/10 flex items-center justify-center shrink-0">
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="#355E3B" aria-hidden="true"><circle cx="4" cy="4" r="3" /></svg>
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-sm text-[#7A6B5D] italic">
                  All paralegal services are performed under the supervision of a licensed attorney. Nothing in this Agreement constitutes the practice of law.
                </p>
              </ContractSection>

              {/* Retainer Fee */}
              <ContractSection title="3. Retainer Fee &amp; Payment Terms">
                <p>
                  Client agrees to pay a monthly retainer fee of <strong>[$ Amount]</strong> ("Retainer Fee"), due on the <strong>1st of each month</strong>. The Retainer Fee covers up to <strong>[X] hours</strong> of paralegal services per month.
                </p>
                <div className="mt-4 space-y-3 text-sm">
                  <FeeRow label="Monthly Retainer" value="$[Amount] / month" />
                  <FeeRow label="Included Hours" value="[X] hours / month" />
                  <FeeRow label="Overage Rate" value="$[Rate] / hour (billed in 0.25-hr increments)" />
                  <FeeRow label="Payment Method" value="ACH, credit card, or check" />
                  <FeeRow label="Late Fee" value="1.5% per month on balances past 15 days" />
                </div>
                <p className="mt-4 text-sm">
                  Unused hours do <strong>not</strong> roll over to the following month. Overage hours will be invoiced separately at the end of each billing cycle.
                </p>
              </ContractSection>

              {/* Term & Termination */}
              <ContractSection title="4. Term &amp; Termination">
                <p>
                  This Agreement commences on <strong>{CONTRACT_DATE}</strong> and continues on a month-to-month basis unless terminated by either party with <strong>30 days' written notice</strong>.
                </p>
                <p className="mt-3">
                  Either party may terminate this Agreement immediately for cause, including but not limited to: non-payment, breach of confidentiality, or conduct that violates applicable law or professional ethics rules.
                </p>
                <p className="mt-3">
                  Upon termination, Client shall pay all outstanding fees for services rendered through the termination date. Any prepaid retainer amounts for unrendered services will be refunded on a pro-rated basis.
                </p>
              </ContractSection>

              {/* Confidentiality */}
              <ContractSection title="5. Confidentiality">
                <p>
                  {PARALEGAL_NAME} agrees to maintain the strict confidentiality of all client information, case materials, and privileged communications received in connection with this Agreement. This obligation survives the termination of this Agreement.
                </p>
                <p className="mt-3">
                  Client acknowledges that {PARALEGAL_NAME} may work with multiple clients simultaneously and agrees that no conflict of interest exists unless specifically disclosed in writing.
                </p>
              </ContractSection>

              {/* Independent Contractor */}
              <ContractSection title="6. Independent Contractor Status">
                <p>
                  {PARALEGAL_NAME} is an independent contractor and not an employee, partner, or agent of the Client. {PARALEGAL_NAME} is solely responsible for all taxes, insurance, and other obligations arising from this independent contractor relationship.
                </p>
                <p className="mt-3">
                  Client shall not withhold income taxes, Social Security, or Medicare from payments to {PARALEGAL_NAME}. A Form 1099 will be issued if required by applicable tax law.
                </p>
              </ContractSection>

              {/* Intellectual Property */}
              <ContractSection title="7. Work Product &amp; Intellectual Property">
                <p>
                  All work product created by {PARALEGAL_NAME} under this Agreement — including research memoranda, drafted documents, and case materials — shall be the sole property of the Client upon receipt of full payment for the services rendered.
                </p>
                <p className="mt-3">
                  {PARALEGAL_NAME} retains the right to use anonymized, non-privileged work samples for professional portfolio purposes unless Client objects in writing within 30 days of delivery.
                </p>
              </ContractSection>

              {/* Limitation of Liability */}
              <ContractSection title="8. Limitation of Liability">
                <p>
                  {PARALEGAL_NAME}'s total liability under this Agreement shall not exceed the total fees paid by Client in the three (3) months preceding the claim. In no event shall {PARALEGAL_NAME} be liable for indirect, incidental, consequential, or punitive damages.
                </p>
                <p className="mt-3 text-sm text-[#7A6B5D] italic">
                  This Agreement does not create an attorney-client relationship. {PARALEGAL_NAME} is not a licensed attorney and does not provide legal advice.
                </p>
              </ContractSection>

              {/* Dispute Resolution */}
              <ContractSection title="9. Dispute Resolution">
                <p>
                  Any dispute arising under this Agreement shall first be addressed through good-faith negotiation. If unresolved within 30 days, the parties agree to submit the dispute to binding arbitration in accordance with the rules of the American Arbitration Association, with proceedings conducted in <strong>[State / Jurisdiction]</strong>.
                </p>
                <p className="mt-3">
                  This Agreement shall be governed by the laws of the State of <strong>[State]</strong>, without regard to conflict-of-law principles.
                </p>
              </ContractSection>

              {/* Entire Agreement */}
              <ContractSection title="10. Entire Agreement">
                <p>
                  This Agreement constitutes the entire agreement between the parties with respect to its subject matter and supersedes all prior negotiations, representations, or agreements. Any modifications must be made in writing and signed by both parties.
                </p>
              </ContractSection>

              {/* Signatures */}
              <div className="mt-12 pt-8 border-t border-[#D9D0C5]">
                <h3 className="text-base font-bold uppercase tracking-widest text-[#4A3728] mb-8">
                  Signatures
                </h3>
                <div className="grid md:grid-cols-2 gap-10">
                  <SignatureBlock
                    label="Service Provider"
                    name={PARALEGAL_NAME}
                    title={PARALEGAL_TITLE}
                  />
                  <SignatureBlock
                    label="Client"
                    name="[Client Full Name]"
                    title="[Title / Firm Name]"
                  />
                </div>
              </div>

              {/* Proprietary Notice */}
              <div className="mt-8 pt-5 border-t-2 border-dashed border-[#355E3B]">
                <div className="rounded-lg p-4" style={{ background: '#f0f7f0', border: '1px solid #c6dfc8' }}>
                  <p className="text-xs font-bold uppercase tracking-widest mb-1 text-[#355E3B]">
                    ⚠ Proprietary Document — {FIRM_NAME}
                  </p>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    This contract and all associated forms are the exclusive property of <strong>{FIRM_NAME}</strong> ({PARALEGAL_EMAIL} · {PARALEGAL_WEBSITE}). These documents are prepared by and for the sole use of <strong>{FIRM_NAME}</strong> and its clients. Unauthorized reproduction, redistribution, or use of these documents outside of an engagement with <strong>{FIRM_NAME}</strong> is strictly prohibited.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer image */}
            <div className="w-full">
              <Image
                src="/assets/images/footer-1780100663536.png"
                alt="Broussard Legal Services footer"
                width={1200}
                height={120}
                className="w-full h-auto block"
              />
            </div>
          </div>
        </section>

        {/* ── Bottom CTA ── */}
        <section className="max-w-4xl mx-auto px-4 md:px-8 mt-10">
          <div className="bg-[#355E3B] rounded-3xl p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[#C8965A] mb-2">Ready to get started?</p>
              <h3 className="font-serif text-2xl text-white">Download, sign, and send.</h3>
              <p className="text-white/70 text-sm mt-1">
                Download the PDF, fill in the bracketed fields, sign, and return by email or upload to the client portal.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#C8965A] text-white text-sm font-semibold uppercase tracking-widest transition-all duration-300 hover:opacity-90 disabled:opacity-60"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                {downloading ? 'Generating…' : 'Download PDF'}
              </button>
              <a
                href={`mailto:${PARALEGAL_EMAIL}?subject=Signed Retainer Contract&body=Please find my signed retainer contract attached.`}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-white/30 text-white text-sm font-semibold uppercase tracking-widest transition-all duration-300 hover:bg-white/10"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
                Send by Email
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ContractSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h3
        className="text-base font-bold uppercase tracking-widest text-[#4A3728] mb-3 pb-2 border-b border-[#D9D0C5]"
        style={{ fontFamily: 'Georgia, serif' }}
      >
        {title}
      </h3>
      <div className="text-sm text-[#2C1F14] space-y-2" style={{ fontFamily: 'Georgia, serif' }}>
        {children}
      </div>
    </div>
  );
}

function PartyBox({
  label,
  name,
  title,
  email,
  website,
}: {
  label: string;
  name: string;
  title: string;
  email: string;
  website: string;
}) {
  return (
    <div className="bg-[#FAF7F2] rounded-xl p-4 border border-[#D9D0C5]">
      <p className="text-xs font-semibold uppercase tracking-widest text-[#C8965A] mb-2">{label}</p>
      <p className="font-bold text-[#4A3728]">{name}</p>
      <p className="text-sm text-[#7A6B5D]">{title}</p>
      <p className="text-sm text-[#7A6B5D] mt-1">{email}</p>
      <p className="text-sm text-[#7A6B5D]">{website}</p>
    </div>
  );
}

function FeeRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#EDE8E0]">
      <span className="text-[#7A6B5D]">{label}</span>
      <span className="font-semibold text-[#4A3728]">{value}</span>
    </div>
  );
}

function SignatureBlock({ label, name, title }: { label: string; name: string; title: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-[#C8965A] mb-4">{label}</p>
      <div className="border-b-2 border-[#4A3728] mb-2 h-12" />
      <p className="text-sm font-bold text-[#4A3728]">{name}</p>
      <p className="text-xs text-[#7A6B5D]">{title}</p>
      <div className="mt-4 flex items-center gap-3">
        <span className="text-xs text-[#7A6B5D]">Date:</span>
        <div className="flex-1 border-b border-[#D9D0C5]" />
      </div>
    </div>
  );
}
