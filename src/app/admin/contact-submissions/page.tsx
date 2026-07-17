'use client';

import React from 'react';
import Link from 'next/link';
import ContactInquiriesAdminDashboard from '@/app/admin/components/ContactInquiriesAdminDashboard';

export default function ContactSubmissionsPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="text-muted-foreground hover:text-foreground transition-colors text-sm flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Admin
            </Link>
            <span className="text-muted-foreground">/</span>
            <h1 className="text-lg font-semibold text-foreground">Contact Submissions</h1>
          </div>
          <p className="text-xs text-muted-foreground">
            View, qualify, and manage all contact form submissions
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <ContactInquiriesAdminDashboard />
      </div>
    </div>
  );
}
