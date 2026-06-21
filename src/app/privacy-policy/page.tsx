'use client';

import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';

const sections = [
  {
    id: 'overview',
    title: '1. Overview',
    content: `Broussard Legal Services ("we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard information when you visit our website or engage our legal services. Please read this policy carefully. If you disagree with its terms, please discontinue use of our site.`,
  },
  {
    id: 'information-collected',
    title: '2. Information We Collect',
    content: `We may collect information you voluntarily provide when you: submit a contact form, request a consultation, engage our services, or create a client portal account. This may include your name, email address, phone number, law firm name, and details about your legal matter. We also automatically collect certain technical information when you visit our site, including IP address, browser type, pages visited, and time spent on pages.`,
  },
  {
    id: 'how-we-use',
    title: '3. How We Use Your Information',
    content: `We use the information we collect to: respond to inquiries and provide requested services; process payments and send invoices; communicate about your engagement; improve our website and service offerings; send administrative communications; comply with legal obligations; and analyze website usage to enhance user experience. We do not sell, rent, or trade your personal information to third parties for marketing purposes.`,
  },
  {
    id: 'disclosure',
    title: '4. Disclosure of Your Information',
    content: `We may share your information with: service providers who assist in our operations (payment processors, email delivery services, cloud storage) under confidentiality obligations; professional advisors such as attorneys or accountants under confidentiality obligations; and government authorities when required by law. All third-party service providers are contractually required to protect your information and use it only for the purposes we specify.`,
  },
  {
    id: 'data-security',
    title: '5. Data Security',
    content: `We implement appropriate technical and organizational security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. These measures include encrypted data transmission (SSL/TLS), secure cloud storage, access controls, and regular security reviews. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.`,
  },
  {
    id: 'cookies',
    title: '6. Cookies & Tracking Technologies',
    content: `Our website uses cookies and similar tracking technologies to enhance your browsing experience and analyze site traffic. We use Google Analytics to understand how visitors interact with our site. You can control cookie settings through your browser preferences. Disabling cookies may affect certain features of our website. We do not use cookies for advertising targeting.`,
  },
  {
    id: 'retention',
    title: '7. Data Retention',
    content: `We retain personal information for as long as necessary to fulfill the purposes outlined in this policy, comply with legal obligations, resolve disputes, and enforce our agreements. Client engagement records are typically retained for seven years following the conclusion of an engagement, consistent with professional standards. You may request deletion of your data subject to applicable legal requirements.`,
  },
  {
    id: 'your-rights',
    title: '8. Your Rights',
    content: `Depending on your location, you may have the right to: access the personal information we hold about you; request correction of inaccurate data; request deletion of your data; object to or restrict certain processing; and data portability. To exercise any of these rights, please contact us using the information below. We will respond to your request within 30 days.`,
  },
  {
    id: 'children',
    title: '9. Children\'s Privacy',
    content: `Our services are not directed to individuals under the age of 18. We do not knowingly collect personal information from children. If you believe we have inadvertently collected information from a minor, please contact us immediately and we will take steps to delete such information.`,
  },
  {
    id: 'changes',
    title: '10. Changes to This Policy',
    content: `We may update this Privacy Policy periodically to reflect changes in our practices or applicable law. We will notify active clients of material changes via email. The date of the most recent revision is noted at the bottom of this page. Your continued use of our services after any changes constitutes acceptance of the updated policy.`,
  },
];

export default function PrivacyPolicyPage() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: 'Privacy Policy',
            description: 'Privacy policy explaining how Broussard Legal Services collects, uses, and protects personal information from clients and website visitors.',
            url: `${baseUrl}/privacy-policy`,
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
      <Header />
      {/* Hero */}
      <section className="pt-32 pb-16 px-6 md:px-10 bg-primary">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent mb-4">Legal</p>
          <h1 className="font-serif text-4xl md:text-5xl text-primary-foreground mb-4 italic">
            Privacy Policy
          </h1>
          <p className="text-primary-foreground/70 text-base max-w-xl">
            How we collect, use, and protect your personal information.
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
            <h3 className="font-serif text-xl text-foreground italic mb-2">Privacy Inquiries</h3>
            <p className="text-muted-foreground text-sm mb-4">
              For questions about this Privacy Policy or to exercise your data rights, please reach out directly.
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
            <Link href="/disclaimers" className="hover:text-foreground transition-colors">Disclaimers</Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
