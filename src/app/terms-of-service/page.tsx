'use client';

import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';

const sections = [
  {
    id: 'acceptance',
    title: '1. Acceptance of Terms',
    content: `By accessing or using the services provided by Maggi May Broussard ("we," "us," or "our"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services. These terms apply to all clients, visitors, and users who access or use our legal services.`,
  },
  {
    id: 'services',
    title: '2. Description of Services',
    content: `Maggi May Broussard provides freelance legal services including, but not limited to: litigation support, contract review, legal research, document drafting, case management, and deposition preparation. All services are provided to licensed attorneys and law firms only. We do not provide legal advice directly to the public.`,
  },
  {
    id: 'not-legal-advice',
    title: '3. No Attorney-Client Relationship',
    content: `Our services are provided to attorneys and law firms as a support resource. Nothing in our communications, deliverables, or website constitutes legal advice, and no attorney-client relationship is formed between Maggi May Broussard and any end client. All work product is intended to assist supervising attorneys who bear sole responsibility for legal advice rendered to their clients.`,
  },
  {
    id: 'engagement',
    title: '4. Engagement & Payment',
    content: `Services are rendered pursuant to a written engagement agreement or statement of work. Fees are outlined in the applicable agreement. A deposit may be required before work commences. Payment is due upon receipt of invoice unless otherwise agreed in writing. Late payments may incur a 1.5% monthly finance charge. We reserve the right to suspend services for overdue accounts.`,
  },
  {
    id: 'confidentiality',
    title: '5. Confidentiality',
    content: `We treat all client information, case materials, and work product as strictly confidential. We will not disclose any information shared with us in the course of an engagement to any third party without your written consent, except as required by law. We maintain appropriate technical and organizational safeguards to protect client data.`,
  },
  {
    id: 'intellectual-property',
    title: '6. Intellectual Property',
    content: `Upon full payment of all fees, all work product created specifically for your engagement becomes your property. We retain the right to use general methodologies, templates, and processes developed in the course of our work. We do not retain copies of client-specific documents beyond the engagement period unless required by law or agreed in writing.`,
  },
  {
    id: 'limitation',
    title: '7. Limitation of Liability',
    content: `To the fullest extent permitted by law, Maggi May Broussard's liability for any claim arising out of or related to our services shall not exceed the total fees paid for the specific engagement giving rise to the claim. We shall not be liable for any indirect, incidental, consequential, or punitive damages. Our services are provided as a support resource to licensed attorneys who retain professional responsibility.`,
  },
  {
    id: 'termination',title: '8. Termination',
    content: `Either party may terminate an engagement with written notice. Upon termination, you agree to pay for all work completed through the termination date. We reserve the right to immediately terminate services if we determine that continued engagement would require us to violate applicable law or professional standards.`,
  },
  {
    id: 'governing-law',title: '9. Governing Law',
    content: `These Terms of Service shall be governed by and construed in accordance with the laws of the State of Louisiana, without regard to its conflict of law provisions. Any disputes arising under these terms shall be resolved in the courts of Louisiana.`,
  },
  {
    id: 'changes',title: '10. Changes to Terms',
    content: `We reserve the right to update these Terms of Service at any time. Material changes will be communicated to active clients via email. Continued use of our services after such changes constitutes acceptance of the updated terms. The date of the most recent revision appears at the bottom of this page.`,
  },
];

export default function TermsOfServicePage() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: 'Terms of Service',
            description: 'Legal terms and conditions for services provided by Maggi May Broussard to law firms and attorneys.',
            url: `${baseUrl}/terms-of-service`,
            image: `${baseUrl}/assets/images/og-image.png`,
            publisher: {
              '@type': 'Organization',
              name: 'Maggi May Broussard',
              logo: {
                '@type': 'ImageObject',
                url: `${baseUrl}/assets/images/app_logo.png`,
              },
            },
          }),
        }}
      />
      <Header />
      {/* Hero */}
      <section className="pt-32 pb-16 px-6 md:px-10 bg-primary">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent mb-4">Legal</p>
          <h1 className="font-serif text-4xl md:text-5xl text-primary-foreground mb-4 italic">
            Terms of Service
          </h1>
          <p className="text-primary-foreground/70 text-base max-w-xl">
            Please read these terms carefully before engaging our legal services.
          </p>
          <p className="text-primary-foreground/50 text-sm mt-4">Last updated: May 2026</p>
        </div>
      </section>
      {/* Content */}
      <main className="flex-1 py-16 px-6 md:px-10">
        <div className="max-w-4xl mx-auto">
          {/* Quick Nav */}
          <div className="mb-12 p-6 rounded-2xl border border-border bg-muted/30">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">On This Page</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {sections?.map((s) => (
                <a
                  key={s?.id}
                  href={`#${s?.id}`}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 flex items-center gap-2 group"
                >
                  <span className="w-1 h-1 rounded-full bg-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                  {s?.title}
                </a>
              ))}
            </div>
          </div>

          {/* Sections */}
          <div className="space-y-10">
            {sections?.map((section) => (
              <div key={section?.id} id={section?.id} className="scroll-mt-24">
                <h2 className="font-serif text-xl md:text-2xl text-foreground mb-3 italic">{section?.title}</h2>
                <div className="w-10 h-px bg-accent mb-4" />
                <p className="text-muted-foreground leading-relaxed text-base">{section?.content}</p>
              </div>
            ))}
          </div>

          {/* Contact */}
          <div className="mt-16 p-8 rounded-2xl border border-border bg-muted/20">
            <h3 className="font-serif text-xl text-foreground italic mb-2">Questions About These Terms?</h3>
            <p className="text-muted-foreground text-sm mb-4">
              If you have any questions about these Terms of Service, please contact us directly.
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold uppercase tracking-widest hover:opacity-90 transition-opacity"
            >
              Contact Us
            </Link>
          </div>

          {/* Legal nav */}
          <div className="mt-10 pt-8 border-t border-border flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Related Legal Pages:</span>
            <Link href="/privacy-policy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            <Link href="/disclaimers" className="hover:text-foreground transition-colors">Disclaimers</Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
