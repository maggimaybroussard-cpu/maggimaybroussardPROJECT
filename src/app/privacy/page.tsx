import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Privacy Policy — Maggi May Broussard',
  description: 'Privacy policy for Maggi May Broussard legal services. Learn how we collect, use, and protect your personal information.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/privacy`,
  },
};

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-6 md:px-10 py-16 md:py-24">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-4">
              Privacy Policy
            </h1>
            <p className="text-muted-foreground">
              Last updated: May 2026
            </p>
          </div>

          {/* Content */}
          <div className="prose prose-invert max-w-none space-y-8 text-foreground">
            {/* 1. What Information We Collect */}
            <section>
              <h2 className="text-2xl font-serif font-bold mb-4">1. What Information We Collect</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                We collect information you provide directly to us and information collected automatically through your use of our website.
              </p>
              <h3 className="text-lg font-semibold mb-3">Information You Provide:</h3>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground mb-4">
                <li>Contact information (name, email, phone number, firm name)</li>
                <li>Service inquiries and messages</li>
                <li>Payment information (processed securely via Stripe)</li>
                <li>Account information for portal access (via Supabase authentication)</li>
              </ul>
              <h3 className="text-lg font-semibold mb-3">Information Collected Automatically:</h3>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Usage data and analytics (via Google Analytics)</li>
                <li>Device information (browser type, operating system)</li>
                <li>IP address and location data</li>
                <li>Cookies and similar tracking technologies</li>
              </ul>
            </section>

            {/* 2. How We Use Your Information */}
            <section>
              <h2 className="text-2xl font-serif font-bold mb-4">2. How We Use Your Information</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                We use the information we collect for the following purposes:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li><strong>Service Delivery:</strong> To process your inquiries, provide legal services, and manage client relationships</li>
                <li><strong>Communication:</strong> To respond to your messages and send service-related updates</li>
                <li><strong>Payment Processing:</strong> To process payments and generate invoices (via Stripe)</li>
                <li><strong>Analytics:</strong> To understand how you use our website and improve our services (via Google Analytics)</li>
                <li><strong>Authentication:</strong> To secure your account and manage portal access (via Supabase)</li>
                <li><strong>Legal Compliance:</strong> To comply with applicable laws and regulations</li>
              </ul>
            </section>

            {/* 3. Cookies and Tracking */}
            <section>
              <h2 className="text-2xl font-serif font-bold mb-4">3. Cookies and Tracking</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                We use cookies and similar tracking technologies to enhance your experience, analyze site traffic, and serve personalized content. For detailed information about the cookies we use, please visit our <Link href="/cookies" className="text-accent hover:underline">Cookie Policy</Link>.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                You can manage your cookie preferences at any time through our cookie preference center or by adjusting your browser settings.
              </p>
            </section>

            {/* 4. Do Not Sell My Personal Information */}
            <section id="do-not-sell">
              <h2 className="text-2xl font-serif font-bold mb-4">4. Do Not Sell My Personal Information</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                We do not sell, rent, or share your personal information with third parties for their marketing purposes. Your privacy is important to us.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-4">
                If you are a California resident, you have the right to know what personal information is collected, used, shared, or sold. You also have the right to delete personal information collected from you and to opt-out of the sale or sharing of your personal information.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                To exercise your privacy rights, please contact us at <a href="mailto:broussardlegalservices@gmail.com" className="text-accent hover:underline">broussardlegalservices@gmail.com</a>.
              </p>
            </section>

            {/* 5. Your Rights */}
            <section>
              <h2 className="text-2xl font-serif font-bold mb-4">5. Your Rights</h2>
              <h3 className="text-lg font-semibold mb-3">GDPR Rights (EU Residents):</h3>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground mb-6">
                <li>Right to access your personal data</li>
                <li>Right to rectification of inaccurate data</li>
                <li>Right to erasure (&ldquo;right to be forgotten&rdquo;)</li>
                <li>Right to restrict processing</li>
                <li>Right to data portability</li>
                <li>Right to object to processing</li>
                <li>Right to withdraw consent at any time</li>
              </ul>
              <h3 className="text-lg font-semibold mb-3">CCPA Rights (California Residents):</h3>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Right to know what personal information is collected</li>
                <li>Right to know whether personal information is sold or disclosed</li>
                <li>Right to delete personal information</li>
                <li>Right to opt-out of the sale or sharing of personal information</li>
                <li>Right to non-discrimination for exercising your privacy rights</li>
              </ul>
            </section>

            {/* 6. Data Retention */}
            <section>
              <h2 className="text-2xl font-serif font-bold mb-4">6. Data Retention</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                We retain your personal information for as long as necessary to provide our services and comply with legal obligations. Specific retention periods depend on the type of data and the purpose for which we use it.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-4">
                <strong>Consent Data:</strong> Your cookie consent preferences are stored locally in your browser (localStorage) under the key <code className="bg-secondary/60 px-2 py-1 rounded text-sm">maggimaybroussard_consent_v1</code>. This data is retained until you clear your browser cookies or explicitly withdraw consent.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                You can delete your consent data at any time by clearing your browser&apos;s local storage or by contacting us.
              </p>
            </section>

            {/* 7. Contact Us */}
            <section>
              <h2 className="text-2xl font-serif font-bold mb-4">7. Contact Us</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                If you have questions about this Privacy Policy or our privacy practices, please contact us:
              </p>
              <div className="bg-secondary/40 border border-border/60 rounded-lg p-6 space-y-3">
                <p className="text-muted-foreground">
                  <strong>Email:</strong> <a href="mailto:broussardlegalservices@gmail.com" className="text-accent hover:underline">broussardlegalservices@gmail.com</a>
                </p>
                <p className="text-muted-foreground">
                  <strong>Website:</strong> <a href={process.env.NEXT_PUBLIC_SITE_URL || 'https://broussardlegalservices.com'} className="text-accent hover:underline">{process.env.NEXT_PUBLIC_SITE_URL || 'https://broussardlegalservices.com'}</a>
                </p>
              </div>
            </section>

            {/* 8. Last Updated */}
            <section className="pt-8 border-t border-border/30">
              <p className="text-sm text-muted-foreground/70">
                This Privacy Policy was last updated in May 2026. We may update this policy from time to time to reflect changes in our practices or applicable laws. We encourage you to review this policy periodically.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
