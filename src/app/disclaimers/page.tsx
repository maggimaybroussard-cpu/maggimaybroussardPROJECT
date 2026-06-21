'use client';

import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';

const sections = [
  {
    id: 'no-legal-advice',
    title: '1. Not Legal Advice',
    content: `The information provided on this website and through our legal services does not constitute legal advice. Broussard Legal Services offers legal support services exclusively to licensed attorneys and law firms. Nothing on this site should be construed as legal counsel, and no attorney-client relationship is created between Broussard Legal Services and any visitor to this website or end client of any law firm we support.`,
  },
  {
    id: 'services-scope',
    title: '2. Scope of Legal Services',
    content: `Our legal support services are limited to tasks performed under the supervision of a licensed attorney. We do not represent clients in court, provide legal opinions, set legal strategy, or advise on the merits of any legal matter. All work product is delivered to supervising attorneys who bear sole professional responsibility for its use and for any legal advice provided to their clients.`,
  },
  {
    id: 'accuracy',
    title: '3. Accuracy of Information',
    content: `While we strive to provide accurate, current, and complete information on this website, we make no representations or warranties of any kind, express or implied, about the completeness, accuracy, reliability, suitability, or availability of the information, products, services, or related graphics contained on this site. Any reliance you place on such information is strictly at your own risk.`,
  },
  {
    id: 'results',
    title: '4. No Guarantee of Results',
    content: `Case studies, client outcomes, and results described on this website are provided for illustrative purposes only. Past results do not guarantee or predict similar outcomes in future matters. Every legal matter is unique, and results depend on many factors including the specific facts, applicable law, jurisdiction, and the skill of the supervising attorney. We make no representation that any particular outcome can be achieved.`,
  },
  {
    id: 'third-party',
    title: '5. Third-Party Links & Resources',
    content: `This website may contain links to third-party websites, resources, or services. These links are provided for your convenience only. We have no control over the content of those sites and accept no responsibility for them or for any loss or damage that may arise from your use of them. Inclusion of any link does not imply endorsement of the linked site or its content.`,
  },
  {
    id: 'professional-rules',
    title: '6. Compliance with Professional Rules',
    content: `Attorneys who engage our services remain solely responsible for compliance with all applicable rules of professional conduct, including rules governing supervision of non-lawyer assistants, client confidentiality, conflicts of interest, and unauthorized practice of law. It is the supervising attorney's responsibility to review all work product before use and to ensure its accuracy and appropriateness for the specific matter.`,
  },
  {
    id: 'jurisdiction',title: '7. Jurisdictional Limitations',
    content: `Our services are provided from Louisiana and are subject to Louisiana law. We make no representation that materials on this website are appropriate or available for use in other locations. Those who access this site from other jurisdictions do so on their own initiative and are responsible for compliance with local laws. We do not represent that our services comply with the laws of any jurisdiction other than Louisiana.`,
  },
  {
    id: 'liability',title: '8. Limitation of Liability',
    content: `To the maximum extent permitted by applicable law, Broussard Legal Services shall not be liable for any direct, indirect, incidental, consequential, special, or exemplary damages arising out of or in connection with your use of this website or our services, including but not limited to damages for loss of profits, goodwill, data, or other intangible losses, even if we have been advised of the possibility of such damages.`,
  },
  {
    id: 'changes',title: '9. Changes to This Disclaimer',
    content: `We reserve the right to modify these disclaimers at any time without prior notice. Changes are effective immediately upon posting to this website. Your continued use of this website or our services following any changes constitutes your acceptance of the revised disclaimers. We encourage you to review this page periodically.`,
  },
];

export default function DisclaimersPage() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: 'Disclaimers',
            description: 'Important disclaimers and limitations regarding legal services provided by Broussard Legal Services to law firms and attorneys.',
            url: `${baseUrl}/disclaimers`,
            image: `${baseUrl}/assets/images/og-image.png`,
            publisher: {
              '@type': 'Organization',
              name: 'Broussard Legal Services',
              logo: {
                '@type': 'ImageObject',
                url: `${baseUrl}/assets/images/app_logo.png`,
              },
            },
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [
              {
                '@type': 'Question',
                name: 'Is Broussard Legal Services operated by a licensed attorney?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'No. Broussard Legal Services is operated by a freelance paralegal, not a licensed attorney. All services are provided exclusively to licensed attorneys and law firms.',
                },
              },
              {
                '@type': 'Question',
                name: 'What is the scope of legal services?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Our legal support services are limited to tasks performed under the supervision of a licensed attorney, including litigation support, legal research, document drafting, and case management.',
                },
              },
            ],
          }),
        }}
      />
      <Header />
      {/* Hero */}
      <section className="pt-32 pb-16 px-6 md:px-10 bg-primary">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent mb-4">Legal</p>
          <h1 className="font-serif text-4xl md:text-5xl text-primary-foreground mb-4 italic">
            Disclaimers
          </h1>
          <p className="text-primary-foreground/70 text-base max-w-xl">
            Important limitations and disclosures regarding our legal services.
          </p>
          <p className="text-primary-foreground/50 text-sm mt-4">Last updated: May 2026</p>
        </div>
      </section>
      {/* Prominent Notice */}
      <div className="px-6 md:px-10 py-6 bg-accent/10 border-b border-accent/20">
        <div className="max-w-4xl mx-auto flex items-start gap-4">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center mt-0.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <p className="text-sm text-foreground leading-relaxed">
            <strong>Important Notice:</strong> Broussard Legal Services offers legal support services exclusively to licensed attorneys and law firms. Nothing on this website constitutes legal advice.
          </p>
        </div>
      </div>
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
            <h3 className="font-serif text-xl text-foreground italic mb-2">Questions or Concerns?</h3>
            <p className="text-muted-foreground text-sm mb-4">
              If you have questions about these disclaimers or our services, we're happy to clarify.
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
            <Link href="/terms-of-service" className="hover:text-foreground transition-colors">Terms of Service</Link>
            <Link href="/privacy-policy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
