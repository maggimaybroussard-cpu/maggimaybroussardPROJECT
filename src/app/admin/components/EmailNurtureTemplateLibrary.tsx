'use client';

import React, { useState, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

type TemplateCategory = 'nurture_sequence' | 'monthly_digest' | 'retainer_renewal';

interface NurtureTemplate {
  id: string;
  category: TemplateCategory;
  sequenceStep?: number;
  totalSteps?: number;
  label: string;
  description: string;
  triggerDelay: string;
  triggerEvent: string;
  subject: string;
  preheader: string;
  badge: string;
  heading: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  variables: string[];
}

interface EditorState {
  subject: string;
  preheader: string;
  badge: string;
  heading: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
}

// ── Template Definitions ──────────────────────────────────────────────────────

const NURTURE_TEMPLATES: NurtureTemplate[] = [
  // ── Nurture Sequences ──
  {
    id: 'nurture_day0_welcome',
    category: 'nurture_sequence',
    sequenceStep: 1,
    totalSteps: 5,
    label: 'Day 0 — Welcome & Introduction',
    description: 'Sent immediately after a prospect submits an inquiry or books a consultation.',
    triggerDelay: 'Immediately',
    triggerEvent: 'Inquiry submitted / consultation booked',
    subject: 'Thank you for reaching out, {{firstName}} — here\'s what happens next',
    preheader: 'Maggi May Broussard will review your inquiry and be in touch within 1 business day.',
    badge: 'Welcome',
    heading: 'Thank You for Reaching Out, {{firstName}}',
    body: `Hi {{firstName}},

Thank you for contacting Broussard Legal Services. I've received your inquiry about {{serviceType}} and will personally review your situation.

Here's what to expect:

• I'll review your inquiry within 1 business day • You'll receive a follow-up to schedule your consultation
• Your consultation will cover your legal options and next steps

In the meantime, feel free to explore our client resources at the link below. If your matter is urgent, please call (504) 458-2831 directly.

I look forward to speaking with you.`,
    ctaLabel: 'Explore Our Services',
    ctaUrl: '{{siteUrl}}/services',
    variables: ['firstName', 'serviceType', 'siteUrl'],
  },
  {
    id: 'nurture_day3_value',
    category: 'nurture_sequence',
    sequenceStep: 2,
    totalSteps: 5,
    label: 'Day 3 — Value Education',
    description: 'Sent 3 days after initial inquiry to educate the prospect on the value of legal services.',
    triggerDelay: '3 days after Day 0',
    triggerEvent: 'Day 3 of nurture sequence',
    subject: '{{firstName}}, what to expect from your {{serviceType}} consultation',
    preheader: 'A quick guide to making the most of your consultation with Maggi May Broussard.',
    badge: 'Consultation Guide',
    heading: 'How to Prepare for Your {{serviceType}} Consultation',
    body: `Hi {{firstName}},

I wanted to share a few tips to help you prepare for our upcoming consultation on your {{serviceType}} matter.

To make the most of our time together, please have the following ready:

• A brief summary of your situation and key dates
• Any relevant documents (contracts, correspondence, notices)
• A list of your questions and priorities
• Contact information for any other parties involved

During our consultation, I'll review your situation, explain your legal options, and outline a clear path forward. There's no obligation — my goal is to make sure you have the information you need.

If you haven't booked your consultation yet, you can schedule directly using the link below.`,
    ctaLabel: 'Book Your Consultation',
    ctaUrl: '{{siteUrl}}/book-consultation',
    variables: ['firstName', 'serviceType', 'siteUrl'],
  },
  {
    id: 'nurture_day7_social_proof',
    category: 'nurture_sequence',
    sequenceStep: 3,
    totalSteps: 5,
    label: 'Day 7 — Social Proof & Outcomes',
    description: 'Sent 7 days after inquiry with client success stories and outcomes.',
    triggerDelay: '7 days after Day 0',
    triggerEvent: 'Day 7 of nurture sequence',
    subject: 'How Broussard Legal Services has helped clients like you, {{firstName}}',
    preheader: 'Real outcomes for real clients — see what\'s possible for your {{serviceType}} matter.',
    badge: 'Client Success',
    heading: 'Real Results for Clients Like You, {{firstName}}',
    body: `Hi {{firstName}},

I wanted to share a few examples of how I've helped clients navigate situations similar to yours. Whether it's a complex contract dispute, a business formation, or a time-sensitive legal matter, my approach is always the same: clear communication, strategic thinking, and a commitment to your best outcome.

Here's what clients say about working with Broussard Legal Services:

"Maggi May was incredibly thorough and kept me informed every step of the way. I felt confident knowing I had expert guidance." — Business Client

"The process was much smoother than I expected. Everything was handled professionally and efficiently." — Contract Matter Client

I'd love to add your success story to this list. If you're ready to move forward, let's schedule your consultation.`,
    ctaLabel: 'Read More Success Stories',
    ctaUrl: '{{siteUrl}}/case-studies',
    variables: ['firstName', 'serviceType', 'siteUrl'],
  },
  {
    id: 'nurture_day14_urgency',
    category: 'nurture_sequence',
    sequenceStep: 4,
    totalSteps: 5,
    label: 'Day 14 — Gentle Urgency',
    description: 'Sent 14 days after inquiry to re-engage prospects who haven\'t booked yet.',
    triggerDelay: '14 days after Day 0',
    triggerEvent: 'Day 14 of nurture sequence',
    subject: '{{firstName}}, your {{serviceType}} matter may have time-sensitive implications',
    preheader: 'Legal matters often have deadlines. Let\'s make sure yours are protected.',
    badge: 'Important Reminder',
    heading: 'Don\'t Let Deadlines Slip By, {{firstName}}',
    body: `Hi {{firstName}},

I wanted to follow up on your inquiry about {{serviceType}}. Legal matters often have statutes of limitations and filing deadlines that can significantly impact your options.

I don't want you to miss an important window because of a delay in getting started.

A brief consultation — even just 30 minutes — can help you understand:

• Whether any deadlines apply to your situation
• What immediate steps (if any) you should take
• Your full range of legal options going forward

There's no pressure and no obligation. My goal is simply to make sure you have the information you need to make the best decision for your situation.

I have availability this week. Would you like to schedule a call?`,
    ctaLabel: 'Check My Availability',
    ctaUrl: '{{siteUrl}}/book-consultation',
    variables: ['firstName', 'serviceType', 'siteUrl'],
  },
  {
    id: 'nurture_day21_final',
    category: 'nurture_sequence',
    sequenceStep: 5,
    totalSteps: 5,
    label: 'Day 21 — Final Check-In',
    description: 'Final nurture email sent 21 days after inquiry for prospects who haven\'t converted.',
    triggerDelay: '21 days after Day 0',
    triggerEvent: 'Day 21 of nurture sequence (final)',
    subject: 'Still here if you need me, {{firstName}}',
    preheader: 'No pressure — just a final note to let you know I\'m available when you\'re ready.',
    badge: 'Final Follow-Up',
    heading: 'I\'m Here When You\'re Ready, {{firstName}}',
    body: `Hi {{firstName}},

This will be my last follow-up regarding your {{serviceType}} inquiry. I don't want to fill your inbox, but I do want you to know that I'm here whenever you're ready.

Legal matters can feel overwhelming, and it's completely normal to need time before taking the next step. Whenever you decide to move forward — whether that's today or six months from now — I'd be honored to help.

You can reach me at any time:
• Schedule online: {{siteUrl}}/book-consultation
• Call or text: (504) 458-2831
• Email: maggimaybroussard@gmail.com

I wish you all the best, {{firstName}}, and I hope to have the opportunity to work with you in the future.`,
    ctaLabel: 'Schedule When You\'re Ready',
    ctaUrl: '{{siteUrl}}/book-consultation',
    variables: ['firstName', 'serviceType', 'siteUrl'],
  },

  // ── Monthly Case Digests ──
  {
    id: 'digest_active_client',
    category: 'monthly_digest',
    label: 'Monthly Case Digest — Active Client',
    description: 'Monthly summary email for active retainer clients covering case activity, hours, and upcoming items.',
    triggerDelay: '1st of each month',
    triggerEvent: 'Monthly digest schedule (active clients)',
    subject: '{{firstName}}, your {{monthName}} case digest — {{caseName}}',
    preheader: 'Your monthly summary: {{hoursUsed}} hours used, {{openItems}} open items, {{upcomingDeadlines}} upcoming deadlines.',
    badge: 'Monthly Digest',
    heading: 'Your {{monthName}} Case Summary, {{firstName}}',
    body: `Hi {{firstName}},

Here is your monthly digest for {{caseName}} covering activity in {{monthName}} {{year}}.

CASE ACTIVITY SUMMARY
Matter: {{caseName}}
Service Type: {{serviceType}}
Current Stage: {{caseStage}}

HOURS & BILLING
Hours Used This Month: {{hoursUsed}}
Retainer Hours Remaining: {{hoursRemaining}}
Invoices Issued: {{invoicesIssued}}
Outstanding Balance: {{outstandingBalance}}

COMPLETED THIS MONTH
{{completedItems}}

UPCOMING ITEMS
{{upcomingItems}}

OPEN ACTION ITEMS
{{openActionItems}}

Log in to your client portal to view full case details, documents, and your complete activity timeline.`,
    ctaLabel: 'View Full Case Details',
    ctaUrl: '{{siteUrl}}/portal/cases',
    variables: ['firstName', 'monthName', 'year', 'caseName', 'serviceType', 'caseStage', 'hoursUsed', 'hoursRemaining', 'invoicesIssued', 'outstandingBalance', 'completedItems', 'upcomingItems', 'openActionItems', 'siteUrl'],
  },
  {
    id: 'digest_post_close',
    category: 'monthly_digest',
    label: 'Monthly Digest — Post-Close Follow-Up',
    description: 'Sent monthly to recently closed clients to maintain the relationship and encourage referrals.',
    triggerDelay: '1st of each month (for 3 months post-close)',
    triggerEvent: 'Monthly digest schedule (closed clients, 90-day window)',
    subject: '{{firstName}}, checking in — {{monthName}} update from Broussard Legal Services',
    preheader: 'A brief check-in from Maggi May Broussard. Your matter closed {{daysAgo}} days ago.',
    badge: 'Staying Connected',
    heading: 'Checking In, {{firstName}}',
    body: `Hi {{firstName}},

I hope this message finds you well. It's been {{daysAgo}} days since we closed your {{matterType}} matter, and I wanted to check in to see how things are going.

If any new questions or issues have come up related to your matter, please don't hesitate to reach out. I'm always happy to provide a brief consultation for former clients.

RESOURCES FOR YOU
• Client Portal: Access your case documents anytime at {{siteUrl}}/portal
• Book a Consultation: {{siteUrl}}/book-consultation
• Refer a Friend: If you know someone who could use legal assistance, I'd be grateful for the referral

Thank you again for trusting me with your {{matterType}} matter. It was a privilege to work with you.`,
    ctaLabel: 'Visit Your Portal',
    ctaUrl: '{{siteUrl}}/portal/dashboard',
    variables: ['firstName', 'monthName', 'daysAgo', 'matterType', 'siteUrl'],
  },
  {
    id: 'digest_prospect_monthly',
    category: 'monthly_digest',
    label: 'Monthly Digest — Prospect Newsletter',
    description: 'Monthly value-add email for prospects and subscribers who haven\'t yet converted to clients.',
    triggerDelay: '1st of each month',
    triggerEvent: 'Monthly digest schedule (subscribers / prospects)',
    subject: '{{monthName}} legal insights from Broussard Legal Services',
    preheader: 'This month: {{digestHighlight}} — plus tips, updates, and resources for you.',
    badge: '{{monthName}} Insights',
    heading: '{{monthName}} Legal Insights for You, {{firstName}}',
    body: `Hi {{firstName}},

Welcome to the {{monthName}} edition of the Broussard Legal Services newsletter. Each month I share practical legal insights, updates, and resources to help you stay informed and protected.

THIS MONTH'S HIGHLIGHT
{{digestHighlight}}

LEGAL TIP OF THE MONTH
{{legalTip}}

PRACTICE AREA SPOTLIGHT: {{spotlightArea}}
{{spotlightContent}}

UPCOMING AVAILABILITY
I have consultation slots available this month for new clients. If you've been considering getting legal guidance on a matter, now is a great time to schedule. Services I'm currently accepting new clients for:
• Business Formation & Contracts
• Employment & Labor Matters
• Real Estate Transactions
• General Legal Consulting

I'm always happy to answer a quick question — just reply to this email.`,
    ctaLabel: 'Book a Consultation',
    ctaUrl: '{{siteUrl}}/book-consultation',
    variables: ['firstName', 'monthName', 'digestHighlight', 'legalTip', 'spotlightArea', 'spotlightContent', 'siteUrl'],
  },

  // ── Retainer Renewal Reminders ──
  {
    id: 'renewal_30day',
    category: 'retainer_renewal',
    label: '30-Day Renewal Notice',
    description: 'Sent 30 days before retainer renewal date to give clients ample notice.',
    triggerDelay: '30 days before renewal date',
    triggerEvent: 'Retainer renewal approaching (30 days)',
    subject: '{{firstName}}, your {{planName}} retainer renews in 30 days',
    preheader: 'Your retainer renews on {{renewalDate}}. Here\'s everything you need to know.',
    badge: '30-Day Renewal Notice',
    heading: 'Your Retainer Renews in 30 Days, {{firstName}}',
    body: `Hi {{firstName}},

This is your 30-day advance notice that your {{planName}} retainer is scheduled to automatically renew on {{renewalDate}}.

RENEWAL DETAILS
Plan: {{planName}}
Renewal Date: {{renewalDate}}
Renewal Amount: {{renewalAmount}}
Billing Cycle: {{billingCycle}}
Payment Method: {{paymentMethodLast4}} ({{paymentMethodType}})

RETAINER USAGE THIS PERIOD
Hours Used: {{hoursUsed}} of {{totalHours}} included hours
Rollover Hours: {{rolloverHours}}
Services Accessed: {{servicesAccessed}}

If you'd like to continue with your current plan, no action is needed — your retainer will renew automatically. If you'd like to upgrade, downgrade, or cancel before the renewal date, please contact me directly or manage your plan in the client portal. Changes must be made at least 5 business days before {{renewalDate}}.`,
    ctaLabel: 'Manage Your Retainer',
    ctaUrl: '{{siteUrl}}/portal/billing',
    variables: ['firstName', 'planName', 'renewalDate', 'renewalAmount', 'billingCycle', 'paymentMethodLast4', 'paymentMethodType', 'hoursUsed', 'totalHours', 'rolloverHours', 'servicesAccessed', 'siteUrl'],
  },
  {
    id: 'renewal_7day',
    category: 'retainer_renewal',
    label: '7-Day Renewal Reminder',
    description: 'Sent 7 days before retainer renewal date as a final reminder.',
    triggerDelay: '7 days before renewal date',
    triggerEvent: 'Retainer renewal approaching (7 days)',
    subject: 'Reminder: {{planName}} retainer renews in 7 days — {{renewalDate}}',
    preheader: '{{renewalAmount}} will be charged on {{renewalDate}}. Manage your plan before then.',
    badge: '7-Day Reminder',
    heading: 'Retainer Renewal in 7 Days, {{firstName}}',
    body: `Hi {{firstName}},

A quick reminder that your {{planName}} retainer will automatically renew in 7 days on {{renewalDate}}.

WHAT WILL HAPPEN
Your {{paymentMethodType}} ending in {{paymentMethodLast4}} will be charged {{renewalAmount}} on {{renewalDate}}.

NEED TO MAKE CHANGES?
If you'd like to modify or cancel your retainer, please act before {{renewalDate}}. You can:

• Manage your plan in the client portal
• Reply to this email with your request
• Call (504) 458-2831

If no changes are needed, your retainer will renew automatically and you'll receive a confirmation email on {{renewalDate}}.

Thank you for your continued trust in Broussard Legal Services.`,
    ctaLabel: 'Manage Your Plan',
    ctaUrl: '{{siteUrl}}/portal/billing',
    variables: ['firstName', 'planName', 'renewalDate', 'renewalAmount', 'paymentMethodLast4', 'paymentMethodType', 'siteUrl'],
  },
  {
    id: 'renewal_confirmed',
    category: 'retainer_renewal',
    label: 'Renewal Confirmed',
    description: 'Sent immediately after a successful retainer renewal payment.',
    triggerDelay: 'Immediately on renewal',
    triggerEvent: 'Retainer renewal payment confirmed',
    subject: '{{planName}} retainer renewed — thank you, {{firstName}}',
    preheader: 'Your {{planName}} retainer has been renewed. Next renewal: {{nextRenewalDate}}.',
    badge: 'Renewal Confirmed',
    heading: 'Your Retainer Has Been Renewed, {{firstName}}',
    body: `Hi {{firstName}},

Your {{planName}} retainer has been successfully renewed. Thank you for your continued trust in Broussard Legal Services.

RENEWAL CONFIRMATION
Plan: {{planName}}
Amount Charged: {{renewalAmount}}
Renewal Date: {{renewalDate}}
Next Renewal: {{nextRenewalDate}}
Payment Method: {{paymentMethodType}} ending in {{paymentMethodLast4}}

YOUR RETAINER BENEFITS (RENEWED)
Included Hours: {{totalHours}} hours per {{billingCycle}}
Priority Response: Within 1 business day
Services: {{includedServices}}

A receipt for this charge has been sent to your billing email. You can view your full billing history and manage your retainer at any time in the client portal.

Thank you again, {{firstName}}. I look forward to continuing to serve you.`,
    ctaLabel: 'View Your Portal',
    ctaUrl: '{{siteUrl}}/portal/billing',
    variables: ['firstName', 'planName', 'renewalAmount', 'renewalDate', 'nextRenewalDate', 'paymentMethodType', 'paymentMethodLast4', 'totalHours', 'billingCycle', 'includedServices', 'siteUrl'],
  },
  {
    id: 'renewal_failed',
    category: 'retainer_renewal',
    label: 'Renewal Payment Failed',
    description: 'Sent when a retainer renewal payment fails, prompting the client to update their payment method.',
    triggerDelay: 'Immediately on payment failure',
    triggerEvent: 'Retainer renewal payment failed',
    subject: 'Action required: {{planName}} renewal payment failed, {{firstName}}',
    preheader: 'Your retainer renewal payment could not be processed. Please update your payment method.',
    badge: 'Payment Action Required',
    heading: 'Retainer Renewal Payment Failed, {{firstName}}',
    body: `Hi {{firstName}},

We were unable to process your {{planName}} retainer renewal payment of {{renewalAmount}} on {{renewalDate}}.

WHAT HAPPENED
Your {{paymentMethodType}} ending in {{paymentMethodLast4}} was declined. This may be due to:

• Insufficient funds or credit limit
• Expired card
• Bank security hold
• Incorrect billing information

WHAT TO DO NOW
Please update your payment method in the client portal as soon as possible to avoid any interruption to your retainer services.

We will automatically retry the payment in 3 days. If the retry also fails, your retainer may be paused until payment is resolved.

If you have any questions or need assistance, please reply to this email or call (504) 458-2831.`,
    ctaLabel: 'Update Payment Method',
    ctaUrl: '{{siteUrl}}/portal/billing',
    variables: ['firstName', 'planName', 'renewalAmount', 'renewalDate', 'paymentMethodType', 'paymentMethodLast4', 'siteUrl'],
  },
  {
    id: 'renewal_cancelled',
    category: 'retainer_renewal',
    label: 'Retainer Cancellation Confirmed',
    description: 'Sent when a client cancels their retainer, confirming the cancellation and offering re-engagement.',
    triggerDelay: 'Immediately on cancellation',
    triggerEvent: 'Retainer subscription cancelled',
    subject: '{{planName}} retainer cancelled — we\'re sorry to see you go, {{firstName}}',
    preheader: 'Your retainer has been cancelled. Your access continues through {{accessEndDate}}.',
    badge: 'Cancellation Confirmed',
    heading: 'Your Retainer Has Been Cancelled, {{firstName}}',
    body: `Hi {{firstName}},

This email confirms that your {{planName}} retainer has been cancelled as requested.

CANCELLATION DETAILS
Plan: {{planName}}
Cancellation Date: {{cancellationDate}}
Access Through: {{accessEndDate}}
Final Charge: {{finalCharge}}

You will continue to have access to your retainer benefits through {{accessEndDate}}. After that date, your portal access will be limited to viewing your case history and documents.

WE'D LOVE TO HAVE YOU BACK If your needs change in the future, you're always welcome to reactivate your retainer or book a one-time consultation. Your case history and documents will be preserved in your portal.

Thank you for being a Broussard Legal Services client, {{firstName}}. It was a privilege to serve you.`,
    ctaLabel: 'View Your Case History',
    ctaUrl: '{{siteUrl}}/portal/dashboard',
    variables: ['firstName', 'planName', 'cancellationDate', 'accessEndDate', 'finalCharge', 'siteUrl'],
  },
];

// ── Category Config ───────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<TemplateCategory, {
  label: string;
  description: string;
  icon: React.ReactNode;
  bg: string;
  text: string;
  border: string;
  dot: string;
  accentBg: string;
}> = {
  nurture_sequence: {
    label: 'Nurture Sequences',
    description: '5-step automated email sequence for new prospects and inquiries',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
    accentBg: 'bg-blue-100',
  },
  monthly_digest: {
    label: 'Monthly Case Digests',
    description: 'Monthly summary emails for active clients, closed clients, and prospects',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
    accentBg: 'bg-emerald-100',
  },
  retainer_renewal: {
    label: 'Retainer Renewal Reminders',
    description: 'Full renewal lifecycle: 30-day notice, 7-day reminder, confirmation, failure, and cancellation',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
      </svg>
    ),
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
    accentBg: 'bg-amber-100',
  },
};

// ── Brand ─────────────────────────────────────────────────────────────────────

const BRAND = {
  bg: '#FAF7F2', primary: '#4A3728', accent: '#C8965A', accentLight: '#F5EDE0',
  foreground: '#2C1F14', muted: '#7A6B5D', border: '#D9D0C5', secondary: '#EDE8E0', white: '#FFFFFF',
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://broussardlegalservices.com';

// ── Email Preview ─────────────────────────────────────────────────────────────

function EmailPreview({ state }: { state: EditorState }) {
  const bodyLines = state.body.split('\n').filter(l => l.trim());
  return (
    <div className="bg-[#EDE8E0] rounded-xl p-4 overflow-auto max-h-[600px]">
      <div className="mx-auto rounded-xl overflow-hidden border" style={{ maxWidth: 520, background: BRAND.bg, borderColor: BRAND.border, boxShadow: '0 4px 24px rgba(74,55,40,0.10)' }}>
        <div style={{ background: BRAND.primary }}>
          <div style={{ height: 4, background: `linear-gradient(to right, ${BRAND.accent}, #E8B87A, ${BRAND.accent})` }} />
          <div style={{ padding: '20px 28px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ borderRight: `2px solid ${BRAND.accent}`, paddingRight: 12 }}>
                <p style={{ margin: 0, fontSize: 9, color: BRAND.accent, letterSpacing: '0.18em', textTransform: 'uppercase', fontFamily: 'Georgia, serif', lineHeight: 1.4 }}>Paralegal</p>
                <p style={{ margin: 0, fontSize: 9, color: BRAND.accent, letterSpacing: '0.18em', textTransform: 'uppercase', fontFamily: 'Georgia, serif', lineHeight: 1.4 }}>Services</p>
              </div>
              <div style={{ paddingLeft: 12 }}>
                <h1 style={{ margin: 0, fontSize: 18, color: BRAND.white, fontFamily: 'Georgia, serif', fontWeight: 'normal' }}>Maggi May Broussard</h1>
                <p style={{ margin: '3px 0 0', fontSize: 10, color: 'rgba(255,255,255,0.65)', fontFamily: 'Georgia, serif' }}>Louisiana &amp; Nationwide</p>
              </div>
            </div>
          </div>
          <div style={{ height: 1, background: `linear-gradient(to right, ${BRAND.accent}, rgba(200,150,90,0.2), transparent)`, margin: '0 28px' }} />
          <div style={{ height: 16 }} />
        </div>
        <div style={{ padding: '28px 28px 24px' }}>
          {state.badge && (
            <span style={{ display: 'inline-block', background: BRAND.accent, color: BRAND.white, fontSize: 9, fontWeight: 'bold', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '3px 12px', borderRadius: 20, marginBottom: 16, fontFamily: 'Georgia, serif' }}>
              {state.badge}
            </span>
          )}
          {state.heading && (
            <h2 style={{ margin: '0 0 16px', fontSize: 17, color: BRAND.foreground, fontFamily: 'Georgia, serif', fontWeight: 'normal', borderBottom: `1px solid ${BRAND.border}`, paddingBottom: 12 }}>
              {state.heading}
            </h2>
          )}
          {bodyLines.map((line, i) => (
            <p key={i} style={{ margin: '0 0 12px', fontSize: 13, color: BRAND.foreground, lineHeight: 1.8, fontFamily: 'Georgia, serif' }}>{line}</p>
          ))}
          {state.ctaLabel && (
            <div style={{ margin: '20px 0' }}>
              <span style={{ display: 'inline-block', background: BRAND.accent, borderRadius: 7, padding: '10px 24px', color: BRAND.white, fontSize: 12, fontFamily: 'Georgia, serif', letterSpacing: '0.05em', fontWeight: 'bold' }}>
                {state.ctaLabel} →
              </span>
            </div>
          )}
          <div style={{ marginTop: 20, borderTop: `1px solid ${BRAND.border}`, paddingTop: 16 }}>
            <p style={{ margin: '0 0 3px', fontSize: 13, color: BRAND.foreground, fontFamily: 'Georgia, serif' }}>Warm regards,</p>
            <p style={{ margin: '0 0 2px', fontSize: 14, color: BRAND.primary, fontWeight: 'bold', fontFamily: 'Georgia, serif' }}>Maggi May Broussard</p>
            <p style={{ margin: '0 0 5px', fontSize: 10, color: BRAND.muted, fontFamily: 'Georgia, serif', letterSpacing: '0.04em' }}>Licensed Paralegal · Louisiana &amp; Nationwide</p>
            <span style={{ color: BRAND.accent, fontSize: 11, fontFamily: 'Georgia, serif' }}>maggimaybroussard@gmail.com</span>
          </div>
        </div>
        <div style={{ background: BRAND.secondary, padding: '14px 28px', borderTop: `1px solid ${BRAND.border}` }}>
          <p style={{ margin: '0 0 4px', fontSize: 10, color: BRAND.primary, fontWeight: 'bold', fontFamily: 'Georgia, serif' }}>Maggi May Broussard Legal Services</p>
          <p style={{ margin: 0, fontSize: 9, color: BRAND.muted, lineHeight: 1.7, fontFamily: 'Georgia, serif' }}>
            You received this email from broussardlegalservices.com · <span style={{ color: BRAND.muted }}>Unsubscribe</span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Template Editor ───────────────────────────────────────────────────────────

function TemplateEditor({ template, onClose }: { template: NurtureTemplate; onClose: () => void }) {
  const [state, setState] = useState<EditorState>({
    subject: template.subject,
    preheader: template.preheader,
    badge: template.badge,
    heading: template.heading,
    body: template.body,
    ctaLabel: template.ctaLabel,
    ctaUrl: template.ctaUrl.replace('{{siteUrl}}', SITE_URL),
  });
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const [copied, setCopied] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);

  const cfg = CATEGORY_CONFIG[template.category];

  const handleCopy = useCallback((field: string, value: string) => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(field);
      setTimeout(() => setCopied(null), 2000);
    });
  }, []);

  const handleSendTest = async () => {
    if (!testEmail) { setSendResult({ success: false, message: 'Please enter a test email address.' }); return; }
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch('/api/notifications/send-transactional', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEmail: testEmail,
          toName: 'Test Recipient',
          type: 'case_update',
          subject: state.subject.replace(/\{\{[^}]+\}\}/g, '[value]'),
          heading: state.heading.replace(/\{\{[^}]+\}\}/g, '[value]'),
          body: state.body.replace(/\{\{[^}]+\}\}/g, '[value]'),
          ctaLabel: state.ctaLabel,
          ctaUrl: state.ctaUrl,
          badge: state.badge,
        }),
      });
      const data = await res.json();
      setSendResult(res.ok
        ? { success: true, message: `Test email sent to ${testEmail}` }
        : { success: false, message: data.error || 'Send failed.' });
    } catch {
      setSendResult({ success: false, message: 'Network error. Please try again.' });
    }
    setSending(false);
  };

  const inputCls = 'w-full border border-[#D9D0C5] rounded-lg px-3 py-2 text-sm text-[#2C1F14] bg-white focus:outline-none focus:ring-2 focus:ring-[#C8965A]/40 focus:border-[#C8965A] placeholder-[#7A6B5D]/50';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto py-8 px-4">
      <div className="w-full max-w-5xl bg-[#FAF7F2] rounded-2xl shadow-2xl border border-[#D9D0C5] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D9D0C5] bg-[#4A3728]">
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
              {cfg.icon} {cfg.label}
            </span>
            <h2 className="text-white font-serif text-lg">{template.label}</h2>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Meta bar */}
        <div className="flex flex-wrap items-center gap-4 px-6 py-3 bg-[#EDE8E0] border-b border-[#D9D0C5] text-xs text-[#7A6B5D]">
          <span className="flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <strong className="text-[#4A3728]">Trigger:</strong> {template.triggerDelay}
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            <strong className="text-[#4A3728]">Event:</strong> {template.triggerEvent}
          </span>
          {template.sequenceStep && (
            <span className="flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              <strong className="text-[#4A3728]">Step:</strong> {template.sequenceStep} of {template.totalSteps}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
            <strong className="text-[#4A3728]">Variables:</strong> {template.variables.join(', ')}
          </span>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#D9D0C5] bg-white">
          {(['edit', 'preview'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-6 py-3 text-sm font-semibold uppercase tracking-widest transition-colors ${tab === t ? 'border-b-2 border-[#C8965A] text-[#4A3728]' : 'text-[#7A6B5D] hover:text-[#4A3728]'}`}
            >
              {t === 'edit' ? 'Edit Template' : 'Live Preview'}
            </button>
          ))}
        </div>

        <div className="p-6">
          {tab === 'edit' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: fields */}
              <div className="flex flex-col gap-4">
                {/* Subject */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-[#4A3728] uppercase tracking-wide">Subject Line</label>
                    <button onClick={() => handleCopy('subject', state.subject)} className="text-xs text-[#C8965A] hover:underline">{copied === 'subject' ? '✓ Copied' : 'Copy'}</button>
                  </div>
                  <input value={state.subject} onChange={e => setState(s => ({ ...s, subject: e.target.value }))} className={inputCls} />
                </div>
                {/* Preheader */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-[#4A3728] uppercase tracking-wide">Preheader Text</label>
                    <button onClick={() => handleCopy('preheader', state.preheader)} className="text-xs text-[#C8965A] hover:underline">{copied === 'preheader' ? '✓ Copied' : 'Copy'}</button>
                  </div>
                  <input value={state.preheader} onChange={e => setState(s => ({ ...s, preheader: e.target.value }))} className={inputCls} />
                </div>
                {/* Badge + Heading */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#4A3728] uppercase tracking-wide mb-1">Badge Label</label>
                    <input value={state.badge} onChange={e => setState(s => ({ ...s, badge: e.target.value }))} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#4A3728] uppercase tracking-wide mb-1">Heading</label>
                    <input value={state.heading} onChange={e => setState(s => ({ ...s, heading: e.target.value }))} className={inputCls} />
                  </div>
                </div>
                {/* Body */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-[#4A3728] uppercase tracking-wide">Email Body</label>
                    <button onClick={() => handleCopy('body', state.body)} className="text-xs text-[#C8965A] hover:underline">{copied === 'body' ? '✓ Copied' : 'Copy'}</button>
                  </div>
                  <textarea value={state.body} onChange={e => setState(s => ({ ...s, body: e.target.value }))} rows={12} className={inputCls + ' resize-none'} />
                </div>
                {/* CTA */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#4A3728] uppercase tracking-wide mb-1">CTA Button Label</label>
                    <input value={state.ctaLabel} onChange={e => setState(s => ({ ...s, ctaLabel: e.target.value }))} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#4A3728] uppercase tracking-wide mb-1">CTA URL</label>
                    <input value={state.ctaUrl} onChange={e => setState(s => ({ ...s, ctaUrl: e.target.value }))} className={inputCls} />
                  </div>
                </div>
                {/* Test send */}
                <div className="border border-[#D9D0C5] rounded-xl p-4 bg-[#EDE8E0]">
                  <p className="text-xs font-semibold text-[#4A3728] uppercase tracking-wide mb-2">Send Test Email via Resend</p>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={testEmail}
                      onChange={e => setTestEmail(e.target.value)}
                      placeholder="test@example.com"
                      className={inputCls + ' flex-1'}
                    />
                    <button
                      onClick={handleSendTest}
                      disabled={sending}
                      className="px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-widest text-white transition-all hover:opacity-90 disabled:opacity-60 whitespace-nowrap"
                      style={{ background: '#4A3728' }}
                    >
                      {sending ? 'Sending…' : 'Send Test'}
                    </button>
                  </div>
                  {sendResult && (
                    <p className={`mt-2 text-xs font-medium ${sendResult.success ? 'text-emerald-700' : 'text-red-600'}`}>
                      {sendResult.success ? '✓ ' : '✗ '}{sendResult.message}
                    </p>
                  )}
                </div>
              </div>
              {/* Right: mini preview */}
              <div>
                <p className="text-xs font-semibold text-[#4A3728] uppercase tracking-wide mb-3">Live Preview</p>
                <EmailPreview state={state} />
              </div>
            </div>
          ) : (
            <EmailPreview state={state} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function EmailNurtureTemplateLibrary() {
  const [activeCategory, setActiveCategory] = useState<TemplateCategory | 'all'>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<NurtureTemplate | null>(null);
  const [search, setSearch] = useState('');

  const categories: TemplateCategory[] = ['nurture_sequence', 'monthly_digest', 'retainer_renewal'];

  const filtered = NURTURE_TEMPLATES.filter(t => {
    const matchCat = activeCategory === 'all' || t.category === activeCategory;
    const matchSearch = !search || t.label.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const countByCategory = (cat: TemplateCategory) => NURTURE_TEMPLATES.filter(t => t.category === cat).length;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl text-[#2C1F14]">Email Template Library</h2>
          <p className="text-sm text-[#7A6B5D] mt-1">
            Reusable branded templates for nurture sequences, monthly case digests, and retainer renewal reminders — all delivered via Resend.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#7A6B5D]">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#EDE8E0] border border-[#D9D0C5] font-semibold text-[#4A3728]">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
            {NURTURE_TEMPLATES.length} Templates
          </span>
        </div>
      </div>

      {/* Category summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {categories.map(cat => {
          const cfg = CATEGORY_CONFIG[cat];
          const count = countByCategory(cat);
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(activeCategory === cat ? 'all' : cat)}
              className={`text-left p-4 rounded-xl border-2 transition-all ${activeCategory === cat ? `${cfg.border} ${cfg.bg}` : 'border-[#D9D0C5] bg-white hover:border-[#C8965A]/40'}`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${cfg.accentBg} ${cfg.text}`}>{cfg.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${activeCategory === cat ? cfg.text : 'text-[#2C1F14]'}`}>{cfg.label}</p>
                  <p className="text-xs text-[#7A6B5D] mt-0.5 leading-snug">{cfg.description}</p>
                  <p className={`text-xs font-bold mt-2 ${cfg.text}`}>{count} template{count !== 1 ? 's' : ''}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7A6B5D]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search templates…"
            className="w-full pl-9 pr-4 py-2.5 border border-[#D9D0C5] rounded-xl text-sm text-[#2C1F14] bg-white focus:outline-none focus:ring-2 focus:ring-[#C8965A]/40 focus:border-[#C8965A]"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-3 py-2 rounded-xl text-xs font-semibold uppercase tracking-widest border transition-all ${activeCategory === 'all' ? 'bg-[#4A3728] text-white border-[#4A3728]' : 'bg-white text-[#7A6B5D] border-[#D9D0C5] hover:border-[#C8965A]'}`}
          >
            All ({NURTURE_TEMPLATES.length})
          </button>
          {categories.map(cat => {
            const cfg = CATEGORY_CONFIG[cat];
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(activeCategory === cat ? 'all' : cat)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold uppercase tracking-widest border transition-all ${activeCategory === cat ? `${cfg.bg} ${cfg.text} ${cfg.border}` : 'bg-white text-[#7A6B5D] border-[#D9D0C5] hover:border-[#C8965A]'}`}
              >
                {cfg.label.split(' ')[0]} ({countByCategory(cat)})
              </button>
            );
          })}
        </div>
      </div>

      {/* Template grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-[#7A6B5D]">
          <svg className="mx-auto mb-3 opacity-40" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
          <p className="text-sm">No templates match your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(template => {
            const cfg = CATEGORY_CONFIG[template.category];
            return (
              <div
                key={template.id}
                className="bg-white border border-[#D9D0C5] rounded-xl overflow-hidden hover:border-[#C8965A]/60 hover:shadow-md transition-all group"
              >
                {/* Card header */}
                <div className={`px-4 py-3 border-b border-[#D9D0C5] ${cfg.bg} flex items-center justify-between`}>
                  <div className="flex items-center gap-2">
                    <span className={`${cfg.text}`}>{cfg.icon}</span>
                    <span className={`text-xs font-semibold uppercase tracking-wide ${cfg.text}`}>{cfg.label}</span>
                  </div>
                  {template.sequenceStep && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.accentBg} ${cfg.text} border ${cfg.border}`}>
                      Step {template.sequenceStep}/{template.totalSteps}
                    </span>
                  )}
                </div>
                {/* Card body */}
                <div className="p-4 flex flex-col gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-[#2C1F14] leading-snug">{template.label}</h3>
                    <p className="text-xs text-[#7A6B5D] mt-1 leading-relaxed">{template.description}</p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-start gap-2 text-xs text-[#7A6B5D]">
                      <svg className="mt-0.5 shrink-0" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      <span><strong className="text-[#4A3728]">Trigger:</strong> {template.triggerDelay}</span>
                    </div>
                    <div className="flex items-start gap-2 text-xs text-[#7A6B5D]">
                      <svg className="mt-0.5 shrink-0" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                      <span className="truncate"><strong className="text-[#4A3728]">Subject:</strong> {template.subject.replace(/\{\{[^}]+\}\}/g, '…')}</span>
                    </div>
                  </div>
                  {/* Variables */}
                  <div className="flex flex-wrap gap-1">
                    {template.variables.slice(0, 4).map(v => (
                      <span key={v} className="text-[10px] px-1.5 py-0.5 rounded bg-[#EDE8E0] text-[#7A6B5D] font-mono border border-[#D9D0C5]">{`{{${v}}}`}</span>
                    ))}
                    {template.variables.length > 4 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#EDE8E0] text-[#7A6B5D] border border-[#D9D0C5]">+{template.variables.length - 4} more</span>
                    )}
                  </div>
                  {/* Action */}
                  <button
                    onClick={() => setSelectedTemplate(template)}
                    className="mt-1 w-full py-2 rounded-lg text-xs font-semibold uppercase tracking-widest border border-[#D9D0C5] text-[#4A3728] bg-[#FAF7F2] hover:bg-[#C8965A] hover:text-white hover:border-[#C8965A] transition-all"
                  >
                    Edit &amp; Preview Template
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Template editor modal */}
      {selectedTemplate && (
        <TemplateEditor
          template={selectedTemplate}
          onClose={() => setSelectedTemplate(null)}
        />
      )}
    </div>
  );
}
