import React from 'react';
import type { Metadata } from 'next';

import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Cookie Policy — Maggi May Broussard',
  description: 'Cookie policy for Maggi May Broussard. Learn about the cookies we use and how to manage your preferences.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/cookies`,
  },
};

export default function CookiesPage() {
  const lastUpdated = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-6 md:px-10 py-16 md:py-24">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-4">
              Cookie Policy
            </h1>
            <p className="text-muted-foreground">
              Last updated: {lastUpdated}
            </p>
          </div>

          {/* Content */}
          <div className="space-y-8 text-foreground">
            {/* 1. What Are Cookies */}
            <section>
              <h2 className="text-2xl font-serif font-bold mb-4">1. What Are Cookies</h2>
              <p className="text-muted-foreground leading-relaxed">
                Cookies are small text files stored on your device when you visit a website. They help websites remember your preferences, track your activity, and provide personalized experiences. Cookies can be session-based (deleted when you close your browser) or persistent (stored until they expire or you delete them). We use cookies to enhance your experience, analyze how you use our site, and serve relevant content.
              </p>
            </section>

            {/* 2. Cookies We Use */}
            <section>
              <h2 className="text-2xl font-serif font-bold mb-4">2. Cookies We Use</h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Below is a detailed list of cookies we use on our website:
              </p>
              <div className="overflow-x-auto border border-border/60 rounded-lg">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-secondary/40 border-b border-border/60">
                      <th className="text-left px-4 py-3 font-semibold text-foreground">Cookie Name</th>
                      <th className="text-left px-4 py-3 font-semibold text-foreground">Category</th>
                      <th className="text-left px-4 py-3 font-semibold text-foreground">Purpose</th>
                      <th className="text-left px-4 py-3 font-semibold text-foreground">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    <tr className="hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground"><code className="bg-secondary/60 px-2 py-1 rounded text-xs">maggimaybroussard_consent_v1</code></td>
                      <td className="px-4 py-3 text-muted-foreground">Necessary</td>
                      <td className="px-4 py-3 text-muted-foreground">Stores your cookie consent preferences</td>
                      <td className="px-4 py-3 text-muted-foreground">Until cleared</td>
                    </tr>
                    <tr className="hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground"><code className="bg-secondary/60 px-2 py-1 rounded text-xs">sb-[ref]-auth-token</code></td>
                      <td className="px-4 py-3 text-muted-foreground">Necessary</td>
                      <td className="px-4 py-3 text-muted-foreground">Supabase authentication session</td>
                      <td className="px-4 py-3 text-muted-foreground">Session</td>
                    </tr>
                    <tr className="hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground"><code className="bg-secondary/60 px-2 py-1 rounded text-xs">__stripe_mid</code></td>
                      <td className="px-4 py-3 text-muted-foreground">Necessary</td>
                      <td className="px-4 py-3 text-muted-foreground">Stripe fraud prevention</td>
                      <td className="px-4 py-3 text-muted-foreground">1 year</td>
                    </tr>
                    <tr className="hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground"><code className="bg-secondary/60 px-2 py-1 rounded text-xs">__stripe_sid</code></td>
                      <td className="px-4 py-3 text-muted-foreground">Necessary</td>
                      <td className="px-4 py-3 text-muted-foreground">Stripe fraud prevention</td>
                      <td className="px-4 py-3 text-muted-foreground">Session</td>
                    </tr>
                    <tr className="hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground"><code className="bg-secondary/60 px-2 py-1 rounded text-xs">_ga</code></td>
                      <td className="px-4 py-3 text-muted-foreground">Analytics</td>
                      <td className="px-4 py-3 text-muted-foreground">Google Analytics usage tracking</td>
                      <td className="px-4 py-3 text-muted-foreground">2 years</td>
                    </tr>
                    <tr className="hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground"><code className="bg-secondary/60 px-2 py-1 rounded text-xs">_gid</code></td>
                      <td className="px-4 py-3 text-muted-foreground">Analytics</td>
                      <td className="px-4 py-3 text-muted-foreground">Google Analytics session tracking</td>
                      <td className="px-4 py-3 text-muted-foreground">24 hours</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* 3. How to Manage Cookies */}
            <section>
              <h2 className="text-2xl font-serif font-bold mb-4">3. How to Manage Cookies</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                You have full control over your cookie preferences. You can manage them in several ways:
              </p>
              <h3 className="text-lg font-semibold mb-3">Using Our Preference Center:</h3>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Click the "Cookie Preferences" button in the footer of our website to open the preference center where you can enable or disable specific cookie categories.
              </p>
              <h3 className="text-lg font-semibold mb-3">Browser Settings:</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Most browsers allow you to control cookies through their settings:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground mb-6">
                <li><strong>Chrome:</strong> Settings → Privacy and security → Cookies and other site data</li>
                <li><strong>Firefox:</strong> Preferences → Privacy & Security → Cookies and Site Data</li>
                <li><strong>Safari:</strong> Preferences → Privacy → Cookies and website data</li>
                <li><strong>Edge:</strong> Settings → Privacy, search, and services → Clear browsing data</li>
              </ul>
              <h3 className="text-lg font-semibold mb-3">Opt-Out Tools:</h3>
              <p className="text-muted-foreground leading-relaxed">
                You can also use third-party opt-out tools to manage cookies across multiple websites. Note that disabling cookies may affect your ability to use certain features of our website.
              </p>
            </section>

            {/* 4. Last Updated */}
            <section className="pt-8 border-t border-border/30">
              <p className="text-sm text-muted-foreground/70">
                This Cookie Policy was last updated on {lastUpdated}. We may update this policy to reflect changes in our cookie practices or applicable laws.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
