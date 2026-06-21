'use client';

import React, { useState } from 'react';
import RetainerInvoiceScheduler from './RetainerInvoiceScheduler';
import StripePaymentReconciliationDashboard from './StripePaymentReconciliationDashboard';
import WeeklyDigestDashboard from './WeeklyDigestDashboard';
import InvoiceTrackingDashboard from './InvoiceTrackingDashboard';

type HubTab = 'invoice_scheduler' | 'reconciliation' | 'digest' | 'late_alerts';

interface HubTabConfig {
  id: HubTab;
  label: string;
  shortLabel: string;
  description: string;
  icon: React.ReactNode;
  accentColor: string;
  badgeText?: string;
}

const HUB_TABS: HubTabConfig[] = [
  {
    id: 'invoice_scheduler',
    label: 'Invoice Scheduler',
    shortLabel: 'Scheduler',
    description: 'Auto-generate retainer invoices on weekly, monthly, or custom schedules with admin approval before sending.',
    accentColor: '#355E3B',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
        <line x1="12" y1="14" x2="12" y2="18"/>
        <line x1="10" y1="16" x2="14" y2="16"/>
      </svg>
    ),
  },
  {
    id: 'reconciliation',
    label: 'Payment Reconciliation',
    shortLabel: 'Reconciliation',
    description: 'Match Stripe payment confirmations against invoices — view sync status, discrepancies, and retry failed payments.',
    accentColor: '#1d4ed8',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2"/>
        <path d="M2 10h20"/>
        <path d="M7 15h.01"/>
        <path d="M11 15h2"/>
      </svg>
    ),
  },
  {
    id: 'digest',
    label: 'Digest Sender',
    shortLabel: 'Digest',
    description: 'Send branded weekly or daily email digests to clients summarizing case updates, action items, and invoice status.',
    accentColor: '#7c3aed',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
        <polyline points="22,6 12,13 2,6"/>
      </svg>
    ),
  },
  {
    id: 'late_alerts',
    label: 'Late-Payment Alerts',
    shortLabel: 'Late Alerts',
    description: 'Track overdue invoices, trigger payment reminder sequences, and monitor alert delivery across all active cases.',
    accentColor: '#b45309',
    badgeText: 'Alerts',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
  },
];

export default function AdminBillingOpsHub() {
  const [activeTab, setActiveTab] = useState<HubTab>('invoice_scheduler');

  const currentTab = HUB_TABS.find((t) => t.id === activeTab)!;

  return (
    <div className="space-y-6">
      {/* Hub Header */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-6 pt-6 pb-0">
          <div className="flex items-start gap-4 mb-5">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white"
              style={{ background: '#355E3B' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <div>
              <h2 className="font-serif text-xl text-foreground leading-tight">Billing Operations Hub</h2>
              <p className="text-sm text-muted-foreground mt-0.5 font-light">
                Secure entry point for invoice scheduling, payment reconciliation, digest delivery, and late-payment alerts.
              </p>
            </div>
          </div>

          {/* Quick-stat strip */}
          <div className="grid grid-cols-4 gap-3 mb-5">
            {HUB_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`group relative rounded-xl border p-3 text-left transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'border-transparent shadow-sm'
                    : 'border-border bg-secondary/20 hover:bg-secondary/40'
                }`}
                style={
                  activeTab === tab.id
                    ? { background: `${tab.accentColor}12`, borderColor: `${tab.accentColor}40` }
                    : {}
                }
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center mb-2 transition-colors"
                  style={{
                    background: activeTab === tab.id ? tab.accentColor : '#f3f4f6',
                    color: activeTab === tab.id ? '#fff' : '#6b7280',
                  }}
                >
                  {tab.icon}
                </div>
                <p
                  className="text-xs font-semibold leading-tight"
                  style={{ color: activeTab === tab.id ? tab.accentColor : undefined }}
                >
                  {tab.shortLabel}
                </p>
                {tab.badgeText && (
                  <span className="absolute top-2 right-2 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                    {tab.badgeText}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab nav bar */}
          <div className="flex items-center gap-0.5 border-b border-border -mx-6 px-6 overflow-x-auto scrollbar-hide">
            {HUB_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-widest transition-all duration-200 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span style={{ color: activeTab === tab.id ? currentTab.accentColor : undefined, opacity: activeTab === tab.id ? 1 : 0.5 }}>
                  {tab.icon}
                </span>
                {tab.label}
                {activeTab === tab.id && (
                  <span
                    className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full"
                    style={{ background: currentTab.accentColor }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Active section description */}
      <div
        className="flex items-start gap-3 px-4 py-3 rounded-xl border text-sm"
        style={{ background: `${currentTab.accentColor}08`, borderColor: `${currentTab.accentColor}30` }}
      >
        <span style={{ color: currentTab.accentColor, flexShrink: 0, marginTop: 1 }}>
          {currentTab.icon}
        </span>
        <div>
          <span className="font-semibold" style={{ color: currentTab.accentColor }}>
            {currentTab.label}
          </span>
          <span className="text-muted-foreground ml-2">{currentTab.description}</span>
        </div>
      </div>

      {/* Panel content */}
      <div>
        {activeTab === 'invoice_scheduler' && <RetainerInvoiceScheduler />}
        {activeTab === 'reconciliation' && <StripePaymentReconciliationDashboard />}
        {activeTab === 'digest' && <WeeklyDigestDashboard />}
        {activeTab === 'late_alerts' && <InvoiceTrackingDashboard />}
      </div>
    </div>
  );
}
