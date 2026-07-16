'use client';

import { mpTrack } from '@/lib/mixpanel';

declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
    dataLayer: unknown[];
  }
}

export function trackEvent(eventName: string, eventParams: Record<string, unknown> = {}) {
  // Fire GA4
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', eventName, eventParams);
  }
  // Fire Mixpanel (dual-tracking)
  mpTrack(eventName, eventParams);
}

// Inquiry / contact form events
export function trackFormStart() {
  trackEvent('form_start', { form_id: 'contact_inquiry', form_name: 'Contact Inquiry Form' });
}

export function trackFieldInteraction(fieldName: string) {
  trackEvent('form_field_interaction', { form_id: 'contact_inquiry', field_name: fieldName });
}

export function trackServiceSelected(serviceName: string) {
  trackEvent('service_selected', { form_id: 'contact_inquiry', service_name: serviceName });
}

export function trackFormSubmitAttempt() {
  trackEvent('form_submit_attempt', { form_id: 'contact_inquiry', form_name: 'Contact Inquiry Form' });
}

export function trackFormSuccess(serviceName: string) {
  trackEvent('form_submit_success', {
    form_id: 'contact_inquiry',
    form_name: 'Contact Inquiry Form',
    service_selected: serviceName,
  });
  // GA4 recommended conversion event
  trackEvent('generate_lead', {
    form_id: 'contact_inquiry',
    service_selected: serviceName,
  });
}

export function trackFormError(errorReason: string) {
  trackEvent('form_submit_error', {
    form_id: 'contact_inquiry',
    error_reason: errorReason,
  });
}

// CTA / navigation events
export function trackCTAClick(ctaLabel: string, ctaLocation: string, destination?: string) {
  trackEvent('cta_click', {
    cta_label: ctaLabel,
    cta_location: ctaLocation,
    destination_url: destination ?? '',
  });
}

// Service card / section engagement
export function trackServiceView(serviceName: string, section: string) {
  trackEvent('service_view', { service_name: serviceName, section });
}

// ── Booking events ──────────────────────────────────────────────────────────

/** Fired when the user opens the booking/availability page */
export function trackBookingPageView() {
  trackEvent('booking_page_view', { page: 'availability' });
}

/** Fired when the user clicks the Calendly CTA to open the scheduler */
export function trackCalendlyOpen(source: string) {
  trackEvent('calendly_open', { source });
}

/** Fired when the user clicks the external Calendly link */
export function trackCalendlyExternalLink() {
  trackEvent('calendly_external_link_click', { page: 'availability' });
}

// ── Payment / booking rate events ───────────────────────────────────────────

/** Fired when the payment modal is opened */
export function trackPaymentModalOpen(source: string) {
  trackEvent('payment_modal_open', { source });
}

/** Fired when the user selects a payment type */
export function trackPaymentTypeSelected(paymentType: string, amount: number) {
  trackEvent('payment_type_selected', {
    payment_type: paymentType,
    value: amount,
    currency: 'USD',
  });
}

/** Fired when the user submits billing details and proceeds to Stripe */
export function trackPaymentDetailsSubmitted(paymentType: string, amount: number) {
  trackEvent('payment_details_submitted', {
    payment_type: paymentType,
    value: amount,
    currency: 'USD',
  });
}

/** Fired on successful payment — GA4 purchase conversion event */
export function trackPaymentSuccess(paymentType: string, amount: number, transactionId: string) {
  trackEvent('purchase', {
    transaction_id: transactionId,
    value: amount,
    currency: 'USD',
    items: [
      {
        item_id: paymentType,
        item_name: paymentType === 'consultation_deposit' ? 'Consultation Deposit' : 'Retainer Agreement',
        price: amount,
        quantity: 1,
      },
    ],
  });
  // Also fire a custom booking_confirmed event for easy filtering
  trackEvent('booking_confirmed', {
    payment_type: paymentType,
    value: amount,
    currency: 'USD',
    transaction_id: transactionId,
  });
}

// ── Invoice Payment Funnel Events ────────────────────────────────────────────

/** Fired when client views the invoice list page */
export function trackInvoiceListView(invoiceCount: number, outstandingCount: number) {
  trackEvent('invoice_list_view', {
    event_category: 'engagement',
    event_label: 'Invoice List Page',
    invoice_count: invoiceCount,
    outstanding_count: outstandingCount,
  });
}

/** Fired when client clicks "Pay Now" on an invoice */
export function trackInvoicePayClick(invoiceId: string, invoiceNumber: string, amount: number) {
  trackEvent('invoice_pay_click', {
    event_category: 'conversion',
    event_label: 'Invoice Pay Now',
    invoice_id: invoiceId,
    invoice_number: invoiceNumber,
    value: amount,
    currency: 'USD',
  });
  // GA4 begin_checkout funnel event
  trackEvent('begin_checkout', {
    value: amount,
    currency: 'USD',
    items: [
      {
        item_id: invoiceId,
        item_name: `Invoice ${invoiceNumber}`,
        price: amount,
        quantity: 1,
        item_category: 'legal_services',
      },
    ],
  });
}

/** Fired when Stripe checkout session is created successfully */
export function trackCheckoutSessionCreated(invoiceId: string, amount: number) {
  trackEvent('checkout_session_created', {
    event_category: 'conversion',
    event_label: 'Stripe Checkout Session Created',
    invoice_id: invoiceId,
    value: amount,
    currency: 'USD',
  });
}

/** Fired on the payment success page after invoice payment */
export function trackInvoicePaymentSuccess(invoiceId: string, invoiceNumber: string, amount: number, sessionId: string) {
  trackEvent('invoice_payment_success', {
    event_category: 'conversion',
    event_label: 'Invoice Payment Confirmed',
    invoice_id: invoiceId,
    invoice_number: invoiceNumber,
    value: amount,
    currency: 'USD',
    session_id: sessionId,
  });
  // GA4 purchase event
  trackEvent('purchase', {
    transaction_id: sessionId || invoiceId,
    value: amount,
    currency: 'USD',
    items: [
      {
        item_id: invoiceId,
        item_name: `Invoice ${invoiceNumber}`,
        price: amount,
        quantity: 1,
        item_category: 'legal_services',
      },
    ],
  });
}

/** Fired when client views an invoice detail page */
export function trackInvoiceDetailView(invoiceId: string, invoiceNumber: string, status: string, amount: number) {
  trackEvent('invoice_detail_view', {
    event_category: 'engagement',
    event_label: 'Invoice Detail Page',
    invoice_id: invoiceId,
    invoice_number: invoiceNumber,
    invoice_status: status,
    value: amount,
  });
}

/** Fired when a payment attempt fails */
export function trackPaymentError(paymentType: string, errorReason: string) {
  trackEvent('payment_error', {
    payment_type: paymentType,
    error_reason: errorReason,
  });
}

// ── Service interest events ──────────────────────────────────────────────────

/** Fired when a service card becomes visible in the viewport */
export function trackServiceImpression(serviceName: string, section: string) {
  trackEvent('service_impression', { service_name: serviceName, section });
}

/** Fired when the user hovers/focuses a service card */
export function trackServiceCardHover(serviceName: string, section: string) {
  trackEvent('service_card_hover', { service_name: serviceName, section });
}

/** Fired when the user clicks "View All Services" CTA */
export function trackViewAllServicesClick(location: string) {
  trackEvent('view_all_services_click', { location });
}

// ── Goal / Conversion Events ─────────────────────────────────────────────────

/**
 * Fired when the user clicks any "Book Consultation" CTA.
 * Maps to a GA4 goal event for conversion funnel visibility.
 */
export function trackBookConsultationClick(location: string) {
  trackEvent('book_consultation_click', {
    cta_location: location,
    event_category: 'conversion',
    event_label: 'Book Consultation',
  });
}

/**
 * Fired when the user clicks any "View Services" CTA.
 * Maps to a GA4 goal event for service interest funnel.
 */
export function trackViewServicesClick(location: string) {
  trackEvent('view_services_click', {
    cta_location: location,
    event_category: 'engagement',
    event_label: 'View Services',
  });
}

/**
 * Fired on successful contact form submission as a named GA4 goal event.
 * Complements trackFormSuccess — use both for full funnel coverage.
 */
export function trackContactFormSubmit(serviceName: string) {
  trackEvent('contact_form_submit', {
    event_category: 'conversion',
    event_label: 'Contact Form Submit',
    service_selected: serviceName,
  });
}

/**
 * Fired on successful contact form submission with full attribution context.
 * Captures source (UTM / referrer), service type, and retainer interest
 * so GA4 can segment which traffic sources and service types convert best.
 */
export function trackContactFormSubmission(params: {
  serviceType: string;
  source?: string;
  retainerTier?: string;
  inquiryId?: string | null;
}) {
  const utmSource =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('utm_source') ?? params.source ?? 'direct'
      : params.source ?? 'direct';

  trackEvent('contact_form_submission', {
    event_category: 'conversion',
    event_label: 'Contact Form Submitted',
    service_type: params.serviceType,
    lead_source: utmSource,
    retainer_tier: params.retainerTier || 'none',
    inquiry_id: params.inquiryId || '',
    form_id: 'contact_inquiry',
  });

  // GA4 recommended lead generation event
  trackEvent('generate_lead', {
    form_id: 'contact_inquiry',
    service_type: params.serviceType,
    lead_source: utmSource,
  });
}

/**
 * Fired when a contact form inquiry is converted into a Lexi case record.
 * Call this after the case is created in Supabase to measure inquiry→case rate.
 */
export function trackInquiryConvertedToCase(params: {
  inquiryId: string;
  serviceType: string;
  source?: string;
}) {
  trackEvent('inquiry_converted_to_case', {
    event_category: 'conversion',
    event_label: 'Inquiry → Lexi Case',
    inquiry_id: params.inquiryId,
    service_type: params.serviceType,
    lead_source: params.source || 'contact_form',
  });
}

/**
 * Fired when a contact form inquiry leads to a Lexi appointment booking.
 * Call this after the appointment is confirmed to measure inquiry→appointment rate.
 */
export function trackInquiryConvertedToAppointment(params: {
  appointmentId?: string;
  serviceType?: string;
  appointmentType?: string;
  source?: string;
}) {
  trackEvent('inquiry_converted_to_appointment', {
    event_category: 'conversion',
    event_label: 'Inquiry → Lexi Appointment',
    appointment_id: params.appointmentId || '',
    service_type: params.serviceType || 'unknown',
    appointment_type: params.appointmentType || 'initial_consultation',
    lead_source: params.source || 'contact_form',
  });
}

/**
 * Fired when Calendly reports a booking via the `event_scheduled` postMessage.
 * Call this inside a window message listener on the availability page.
 */
export function trackCalendlyBooking(source: string = 'availability_page') {
  trackEvent('calendly_booking_confirmed', {
    event_category: 'conversion',
    event_label: 'Calendly Booking',
    source,
  });
  // Also fire GA4 recommended conversion event
  trackEvent('generate_lead', {
    form_id: 'calendly_booking',
    source,
  });
}

/**
 * Fired when the services page loads — measures service page interest as a
 * top-of-funnel conversion signal.
 */
export function trackServicePageView() {
  trackEvent('service_page_view', {
    event_category: 'engagement',
    event_label: 'Services Page',
    page: 'services',
  });
}

/**
 * Fired when a user clicks a CTA inside a service card (e.g. "Get Started",
 * "Learn More", or any in-card link) to measure per-service lead intent.
 */
export function trackServiceDetailClick(serviceName: string, ctaLabel: string) {
  trackEvent('service_detail_click', {
    event_category: 'conversion',
    event_label: ctaLabel,
    service_name: serviceName,
  });
}

/**
 * Fired when the payment-confirmation page loads with a valid payment_intent.
 * This is the definitive booking confirmation conversion event.
 * Complements trackPaymentSuccess (which fires inside the modal before redirect).
 */
export function trackBookingConfirmationPageView(
  paymentType: string,
  amount: number,
  transactionId: string
) {
  trackEvent('booking_confirmation_view', {
    event_category: 'conversion',
    event_label: 'Booking Confirmed',
    payment_type: paymentType,
    value: amount,
    currency: 'USD',
    transaction_id: transactionId,
  });
}

/**
 * Fired to capture lead quality signals — combines source, service, and
 * conversion path into a single event for ROI attribution.
 */
export function trackLeadQuality(params: {
  source: 'contact_form' | 'chatbot' | 'calendly' | 'payment';
  service?: string;
  conversionType: 'inquiry' | 'booking' | 'payment';
  value?: number;
}) {
  trackEvent('lead_quality', {
    event_category: 'conversion',
    lead_source: params.source,
    service_name: params.service ?? 'unknown',
    conversion_type: params.conversionType,
    value: params.value ?? 0,
    currency: 'USD',
  });
}

// ── Service View (click intent) ──────────────────────────────────────────────

/**
 * Fired when a user clicks on a service card to signal explicit view intent.
 * Distinct from trackServiceImpression (scroll-into-view) and trackServiceCardHover.
 * Use this to measure which services drive the most active interest.
 */
export function trackServiceCardClick(serviceName: string, section: string) {
  trackEvent('service_card_click', {
    event_category: 'engagement',
    event_label: serviceName,
    service_name: serviceName,
    section,
  });
  // Also fire the existing service_view event for backward compatibility
  trackEvent('service_view', { service_name: serviceName, section });
}

// ── Booking Completion Funnel ────────────────────────────────────────────────

/**
 * Fired when a Calendly booking is fully confirmed (event_scheduled postMessage).
 * This is the definitive top-of-funnel booking conversion — use to measure
 * booking completion rate vs. page views and CTA clicks.
 */
export function trackBookingComplete(params: {
  source: string;
  inviteeName?: string;
  hasEmail?: boolean;
}) {
  trackEvent('booking_complete', {
    event_category: 'conversion',
    event_label: 'Calendly Booking Complete',
    booking_source: params.source,
    has_invitee_name: !!params.inviteeName,
    has_invitee_email: !!params.hasEmail,
  });
}

// ── Document Upload / Download ───────────────────────────────────────────────

/**
 * Fired when one or more documents are successfully uploaded to the portal.
 * Tracks folder destination and file count to identify upload patterns.
 */
export function trackDocumentUpload(params: {
  folder: string;
  fileCount: number;
  totalSizeBytes: number;
}) {
  trackEvent('document_upload', {
    event_category: 'conversion',
    event_label: 'Document Upload Success',
    upload_folder: params.folder,
    file_count: params.fileCount,
    total_size_kb: Math.round(params.totalSizeBytes / 1024),
  });
}

/**
 * Fired when a document upload fails — captures folder and error reason
 * to identify bottlenecks in the upload flow.
 */
export function trackDocumentUploadError(params: {
  folder: string;
  errorReason: string;
}) {
  trackEvent('document_upload_error', {
    event_category: 'error',
    event_label: 'Document Upload Failed',
    upload_folder: params.folder,
    error_reason: params.errorReason,
  });
}

/**
 * Fired when a client downloads a document from the portal.
 * Tracks file type and folder to understand which documents are accessed most.
 */
export function trackDocumentDownload(params: {
  folder: string;
  mimeType: string;
  fileSizeBytes: number;
}) {
  trackEvent('document_download', {
    event_category: 'engagement',
    event_label: 'Document Download',
    download_folder: params.folder,
    file_type: params.mimeType,
    file_size_kb: Math.round(params.fileSizeBytes / 1024),
  });
}

// ── Campaign Conversion Events ───────────────────────────────────────────────

/**
 * Fired when the email opt-in form is successfully submitted.
 * Measures newsletter/lead-capture conversion rate.
 */
export function trackEmailOptInSubmit(email?: string) {
  trackEvent('email_optin_submit', {
    event_category: 'conversion',
    event_label: 'Email Opt-In Form Submit',
    form_id: 'email_optin',
    has_email: !!email,
  });
  // GA4 recommended lead event
  trackEvent('generate_lead', {
    form_id: 'email_optin',
    source: 'newsletter_signup',
  });
}

/**
 * Fired when a user clicks a service card link (explicit navigation intent).
 * Distinct from hover — measures which services drive active click-throughs.
 */
export function trackServiceClick(serviceName: string, section: string) {
  trackEvent('service_click', {
    event_category: 'conversion',
    event_label: serviceName,
    service_name: serviceName,
    section,
  });
}

/**
 * Fired when the pricing page is opened/viewed.
 * Measures top-of-funnel pricing interest as a campaign conversion signal.
 */
export function trackPricingPageOpen() {
  trackEvent('pricing_page_open', {
    event_category: 'conversion',
    event_label: 'Pricing Page Opened',
    page: 'pricing',
  });
}

// ── Checkout Funnel Events ───────────────────────────────────────────────────

/**
 * Fired when the user submits the consultation form with instant booking
 * and the $150 deposit payment is confirmed via Stripe.
 * Maps to the "deposit_submitted" step in the checkout funnel.
 */
export function trackDepositSubmitted(transactionId: string) {
  trackEvent('deposit_submitted', {
    event_category: 'conversion',
    event_label: 'Consultation Deposit Submitted',
    payment_type: 'consultation_deposit',
    value: 150,
    currency: 'USD',
    transaction_id: transactionId,
  });
  // GA4 recommended purchase event for deposit
  trackEvent('purchase', {
    transaction_id: transactionId,
    value: 150,
    currency: 'USD',
    items: [
      {
        item_id: 'consultation_deposit',
        item_name: 'Consultation Deposit',
        price: 150,
        quantity: 1,
      },
    ],
  });
}

/**
 * Fired when a retainer package (Professional or Enterprise) is purchased
 * successfully via the /checkout page.
 * Maps to the "retainer_purchased" step in the checkout funnel.
 */
export function trackRetainerPurchased(packageName: string, amount: number, transactionId: string) {
  trackEvent('retainer_purchased', {
    event_category: 'conversion',
    event_label: 'Retainer Package Purchased',
    payment_type: 'retainer',
    package_name: packageName,
    value: amount,
    currency: 'USD',
    transaction_id: transactionId,
  });
  // GA4 recommended purchase event for retainer
  trackEvent('purchase', {
    transaction_id: transactionId,
    value: amount,
    currency: 'USD',
    items: [
      {
        item_id: 'retainer',
        item_name: packageName,
        price: amount,
        quantity: 1,
      },
    ],
  });
}

/**
 * Fired when a Stripe payment attempt fails at any point in the checkout funnel
 * (deposit on pricing page or retainer on checkout page).
 * Use to identify conversion drop-off points by payment_type and error_reason.
 */
export function trackCheckoutPaymentFailed(paymentType: string, errorReason: string, value: number) {
  trackEvent('payment_failed', {
    event_category: 'checkout_funnel',
    event_label: 'Payment Failed',
    payment_type: paymentType,
    error_reason: errorReason,
    value,
    currency: 'USD',
  });
}

/**
 * Fired when a user scans (or clicks) the QR code to visit the site.
 * Since QR scans open the URL directly, this fires when the QR section
 * becomes visible — use alongside UTM params on the QR URL for full attribution.
 */
export function trackQRCodeScan() {
  trackEvent('qr_code_scan', {
    event_category: 'conversion',
    event_label: 'QR Code Scanned',
    source: 'qr_code_section',
  });
}

/**
 * Fired when a user clicks the Email share button in the QR/share section.
 * Measures email-based referral sharing as a campaign amplification signal.
 */
export function trackEmailShare() {
  trackEvent('email_share', {
    event_category: 'conversion',
    event_label: 'Email Share Click',
    method: 'email',
    content_type: 'site_url',
  });
  // GA4 recommended share event
  trackEvent('share', {
    method: 'email',
    content_type: 'site_url',
    item_id: 'homepage',
  });
}

// ── Lead Source Attribution ──────────────────────────────────────────────────

/**
 * Captures UTM parameters and referrer on page load to attribute lead source.
 * Call once on the homepage (or root layout) to record traffic origin.
 */
export function trackLeadSourceAttribution() {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  const utmSource = params.get('utm_source') ?? '';
  const utmMedium = params.get('utm_medium') ?? '';
  const utmCampaign = params.get('utm_campaign') ?? '';
  const utmContent = params.get('utm_content') ?? '';
  const utmTerm = params.get('utm_term') ?? '';
  const referrer = document.referrer ?? '';

  // Only fire if there is meaningful attribution data
  if (!utmSource && !referrer) return;

  trackEvent('lead_source_attribution', {
    event_category: 'attribution',
    utm_source: utmSource,
    utm_medium: utmMedium,
    utm_campaign: utmCampaign,
    utm_content: utmContent,
    utm_term: utmTerm,
    referrer: referrer.slice(0, 200), // cap length
    landing_page: window.location.pathname,
  });
}

// ── Conversion Funnel: Homepage → Signup ─────────────────────────────────────

/**
 * Step 1 of the signup funnel — user is on the homepage.
 * Fired once when the homepage mounts to mark funnel entry.
 */
export function trackFunnelHomepageView() {
  trackEvent('funnel_homepage_view', {
    event_category: 'signup_funnel',
    funnel_step: 1,
    funnel_step_name: 'homepage',
  });
}

// ── ROI Conversion Events ────────────────────────────────────────────────────

/**
 * Fired when a user navigates from the homepage to the /services page.
 * Measures homepage-to-services conversion rate as a top-of-funnel ROI signal.
 * Call on the services page mount when the referrer is the homepage.
 */
export function trackHomepageToServicesConversion() {
  trackEvent('homepage_to_services', {
    event_category: 'conversion',
    event_label: 'Homepage → Services',
    funnel_step: 'services_page_reached',
    referrer: typeof window !== 'undefined' ? document.referrer : '',
  });
}

/**
 * Fired when a consultation booking is fully confirmed via the custom scheduler.
 * Captures duration, date, and email-sent status for ROI reporting.
 * This is the definitive consultation booking conversion event.
 */
export function trackConsultationBookingComplete(params: {
  bookingId: string;
  durationMinutes: number;
  bookingDate: string;
  emailSent: boolean;
  source?: string;
}) {
  trackEvent('consultation_booking_complete', {
    event_category: 'conversion',
    event_label: 'Consultation Booked',
    booking_id: params.bookingId,
    duration_minutes: params.durationMinutes,
    booking_date: params.bookingDate,
    email_sent: params.emailSent,
    booking_source: params.source ?? 'scheduler',
  });
  // GA4 recommended conversion event for lead gen
  trackEvent('generate_lead', {
    form_id: 'consultation_scheduler',
    booking_id: params.bookingId,
    duration_minutes: params.durationMinutes,
    source: params.source ?? 'scheduler',
  });
}

/**
 * Fired on successful contact/inquiry form submission for ROI attribution.
 * Captures the service type and lead source to measure form-to-revenue path.
 * Complements trackContactFormSubmission — use this for simplified ROI dashboards.
 */
export function trackFormSubmissionROI(params: {
  formId: string;
  serviceType?: string;
  source?: string;
}) {
  const utmSource =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('utm_source') ?? params.source ?? 'direct'
      : params.source ?? 'direct';

  trackEvent('form_submission_roi', {
    event_category: 'conversion',
    event_label: 'Form Submitted',
    form_id: params.formId,
    service_type: params.serviceType ?? 'general',
    lead_source: utmSource,
  });
}

/**
 * Step 2 — user clicks a CTA that leads toward the portal/signup.
 * Call with the CTA label and location so we know which entry point converts.
 */
export function trackFunnelSignupCTAClick(ctaLabel: string, ctaLocation: string) {
  trackEvent('funnel_signup_cta_click', {
    event_category: 'signup_funnel',
    funnel_step: 2,
    funnel_step_name: 'signup_cta_click',
    cta_label: ctaLabel,
    cta_location: ctaLocation,
  });
}

/**
 * Step 3 — user lands on the portal register page.
 */
export function trackFunnelRegisterPageView() {
  trackEvent('funnel_register_page_view', {
    event_category: 'signup_funnel',
    funnel_step: 3,
    funnel_step_name: 'register_page',
  });
}

/**
 * Step 4 — user starts filling in the registration form.
 */
export function trackFunnelRegisterFormStart() {
  trackEvent('funnel_register_form_start', {
    event_category: 'signup_funnel',
    funnel_step: 4,
    funnel_step_name: 'register_form_start',
  });
}

/**
 * Step 5 — user successfully creates an account (signup complete).
 * This is the primary signup conversion event.
 */
export function trackFunnelSignupComplete() {
  trackEvent('funnel_signup_complete', {
    event_category: 'signup_funnel',
    funnel_step: 5,
    funnel_step_name: 'signup_complete',
  });
  // GA4 recommended sign_up event
  trackEvent('sign_up', { method: 'email' });
}

/**
 * Fired when a user successfully signs in to the portal.
 * Measures returning-client engagement.
 */
export function trackPortalLogin(method: string = 'email') {
  trackEvent('portal_login', {
    event_category: 'engagement',
    event_label: 'Portal Login',
    method,
  });
  // GA4 recommended login event
  trackEvent('login', { method });
}

// ── Case Milestones ──────────────────────────────────────────────────────────

/**
 * Fired when a client views a specific case detail page.
 */
export function trackCaseView(caseId: string, caseStage: string, serviceType: string) {
  trackEvent('case_view', {
    event_category: 'case_milestone',
    case_id: caseId,
    case_stage: caseStage,
    service_type: serviceType,
  });
}

/**
 * Fired when a case stage/status changes (admin or system update).
 * Use to measure pipeline velocity and stage conversion rates.
 */
export function trackCaseStageChange(caseId: string, fromStage: string, toStage: string, serviceType: string) {
  trackEvent('case_stage_change', {
    event_category: 'case_milestone',
    event_label: `${fromStage} → ${toStage}`,
    case_id: caseId,
    from_stage: fromStage,
    to_stage: toStage,
    service_type: serviceType,
  });
}

/**
 * Fired when a client views the portal cases list page.
 */
export function trackPortalCasesView(caseCount: number) {
  trackEvent('portal_cases_view', {
    event_category: 'engagement',
    case_count: caseCount,
  });
}

// ── Invoice Milestones ───────────────────────────────────────────────────────

/**
 * Fired when a client views the billing/invoices page.
 */
export function trackPortalBillingView(invoiceCount: number, outstandingCount: number) {
  trackEvent('portal_billing_view', {
    event_category: 'invoice_milestone',
    invoice_count: invoiceCount,
    outstanding_invoice_count: outstandingCount,
  });
}

/**
 * Fired when a client opens/views a specific invoice.
 */
export function trackInvoiceView(invoiceId: string, invoiceNumber: string, amount: number, status: string) {
  trackEvent('invoice_view', {
    event_category: 'invoice_milestone',
    invoice_id: invoiceId,
    invoice_number: invoiceNumber,
    value: amount,
    currency: 'USD',
    invoice_status: status,
  });
}

/**
 * Fired when a client clicks "Pay Now" on an invoice — starts the payment flow.
 */
export function trackInvoicePaymentStart(invoiceId: string, invoiceNumber: string, amount: number) {
  trackEvent('invoice_payment_start', {
    event_category: 'invoice_milestone',
    event_label: 'Invoice Payment Started',
    invoice_id: invoiceId,
    invoice_number: invoiceNumber,
    value: amount,
    currency: 'USD',
  });
}

/**
 * Fired when an invoice payment is confirmed (success return from Stripe).
 * This is the definitive invoice conversion event.
 */
export function trackInvoicePaid(invoiceId: string, invoiceNumber: string, amount: number) {
  trackEvent('invoice_paid', {
    event_category: 'invoice_milestone',
    event_label: 'Invoice Paid',
    invoice_id: invoiceId,
    invoice_number: invoiceNumber,
    value: amount,
    currency: 'USD',
  });
  // GA4 recommended purchase event for invoice payment
  trackEvent('purchase', {
    transaction_id: invoiceId,
    value: amount,
    currency: 'USD',
    items: [
      {
        item_id: invoiceId,
        item_name: `Invoice ${invoiceNumber}`,
        price: amount,
        quantity: 1,
      },
    ],
  });
}

/**
 * Fired when an invoice becomes overdue (detected on billing page load).
 */
export function trackInvoiceOverdue(invoiceId: string, invoiceNumber: string, amount: number) {
  trackEvent('invoice_overdue', {
    event_category: 'invoice_milestone',
    event_label: 'Invoice Overdue',
    invoice_id: invoiceId,
    invoice_number: invoiceNumber,
    value: amount,
    currency: 'USD',
  });
}

// ── Retainer Tier Interest ────────────────────────────────────────────────────

/**
 * Fired when a visitor selects a retainer tier on the contact form or clicks
 * a tier CTA on the pricing section. Measures which tiers drive the most
 * lead intent — use to calculate ROI by tier in GA4 explorations.
 *
 * @param tierName   - Human-readable tier label (e.g. "Starter", "Standard", "Growth", "Project / Hourly")
 * @param tierId     - Machine-readable tier ID (e.g. "starter", "standard", "growth", "project")
 * @param source     - Where the interaction happened: "contact_form" | "pricing_section"
 * @param price      - Monthly price string for the tier (e.g. "$650/mo")
 */
export function trackRetainerTierInterest(params: {
  tierName: string;
  tierId: string;
  source: 'contact_form' | 'pricing_section';
  price?: string;
}) {
  trackEvent('retainer_tier_interest', {
    event_category: 'conversion_funnel',
    event_label: params.tierName,
    tier_id: params.tierId,
    tier_name: params.tierName,
    tier_price: params.price ?? '',
    interaction_source: params.source,
  });
  // Also fire GA4 recommended view_item for tier-level ROI attribution
  trackEvent('view_item', {
    items: [
      {
        item_id: params.tierId,
        item_name: `Retainer – ${params.tierName}`,
        item_category: 'retainer',
        price: 0, // price is subscription-based; use tier_price param for display
      },
    ],
  });
}

// ── Google Calendar Booking ───────────────────────────────────────────────────

/**
 * Fired when a visitor clicks the "Open in Google Calendar" button or the *"View All Booking Options" CTA in the Google Calendar booking section.
 * Measures Google Calendar as a booking channel vs. Calendly.
 *
 * @param ctaLabel  - Button label (e.g. "Open in Google Calendar", "View All Booking Options")
 * @param location  - Section identifier (e.g. "contact_page_gcal_section")
 */
export function trackGoogleCalendarBookingClick(ctaLabel: string, location: string) {
  trackEvent('google_calendar_booking_click', {
    event_category: 'conversion',
    event_label: ctaLabel,
    cta_location: location,
    booking_channel: 'google_calendar',
  });
  trackEvent('book_consultation_click', {
    cta_location: location,
    event_category: 'conversion',
    event_label: ctaLabel,
    booking_channel: 'google_calendar',
  });
}

// ── Lead Qualification Rate ───────────────────────────────────────────────────

/**
 * Fired when an admin marks a contact lead as qualified or unqualified.
 * Tracks qualification decisions per tier and service to measure funnel
 * effectiveness and lead quality by acquisition source.
 *
 * @param inquiryId      - Supabase ID of the contact_inquiry row
 * @param isQualified    - true = qualified, false = unqualified, null = reset/unset
 * @param retainerTier   - The tier tag on the lead (e.g. "starter", "growth")
 * @param serviceTag     - The service interest tag on the lead
 * @param previousValue  - The prior qualification state before this change
 */
export function trackLeadQualificationChange(params: {
  inquiryId: string;
  isQualified: boolean | null;
  retainerTier?: string | null;
  serviceTag?: string | null;
  previousValue?: boolean | null;
}) {
  const qualificationLabel =
    params.isQualified === true
      ? 'qualified'
      : params.isQualified === false
      ? 'unqualified'
      : 'unset';

  trackEvent('lead_qualification_change', {
    event_category: 'lead_management',
    event_label: qualificationLabel,
    inquiry_id: params.inquiryId,
    qualification_status: qualificationLabel,
    retainer_tier: params.retainerTier ?? 'none',
    service_interest: params.serviceTag ?? 'none',
    previous_status:
      params.previousValue === true
        ? 'qualified'
        : params.previousValue === false
        ? 'unqualified'
        : 'unset',
  });

  // Fire a dedicated conversion event when a lead is marked qualified
  if (params.isQualified === true) {
    trackEvent('lead_qualified', {
      event_category: 'conversion_funnel',
      event_label: 'Lead Qualified',
      retainer_tier: params.retainerTier ?? 'none',
      service_interest: params.serviceTag ?? 'none',
    });
    // GA4 recommended generate_lead for qualified leads
    trackEvent('generate_lead', {
      form_id: 'contact_inquiry',
      source: 'admin_qualification',
      retainer_tier: params.retainerTier ?? 'none',
    });
  }
}

// ── Intake Form Completion ────────────────────────────────────────────────────

/**
 * Fired when the Typeform intake form is successfully submitted.
 * Captures lead source (UTM params / referrer) and the service type
 * selected by the respondent for conversion attribution.
 *
 * @param serviceType  - The service area selected in the intake form (e.g. "Contract Review")
 * @param responseId   - Typeform response ID for cross-referencing submissions
 */
export function trackIntakeFormComplete(params: {
  serviceType: string;
  responseId?: string;
}) {
  const leadSource = (() => {
    if (typeof window === 'undefined') return 'direct';
    const searchParams = new URLSearchParams(window.location.search);
    const utmSource = searchParams.get('utm_source');
    if (utmSource) return utmSource;
    const referrer = document.referrer;
    if (!referrer) return 'direct';
    try {
      return new URL(referrer).hostname;
    } catch {
      return 'direct';
    }
  })();

  const utmMedium = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('utm_medium') ?? ''
    : '';
  const utmCampaign = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('utm_campaign') ?? ''
    : '';

  // Primary intake completion event
  trackEvent('intake_form_complete', {
    event_category: 'conversion',
    event_label: 'Intake Form Submitted',
    form_id: 'intake_typeform',
    service_type: params.serviceType,
    lead_source: leadSource,
    utm_medium: utmMedium,
    utm_campaign: utmCampaign,
    response_id: params.responseId ?? '',
  });

  // GA4 recommended generate_lead conversion event
  trackEvent('generate_lead', {
    form_id: 'intake_typeform',
    source: leadSource,
    service_type: params.serviceType,
  });
}

// ── Time Tracking Events ─────────────────────────────────────────────────────

/**
 * Fired when admin starts the live timer in the Billable Hours Logger.
 */
export function trackTimerStart(clientName?: string) {
  trackEvent('time_tracker_start', {
    event_category: 'time_tracking',
    event_label: 'Timer Started',
    client_name: clientName ?? 'unknown',
  });
}

/**
 * Fired when admin stops the live timer and logs hours.
 */
export function trackTimerStop(hours: number, clientName?: string, workType?: string) {
  trackEvent('time_tracker_stop', {
    event_category: 'time_tracking',
    event_label: 'Timer Stopped',
    hours_logged: hours,
    client_name: clientName ?? 'unknown',
    work_type: workType ?? 'unknown',
  });
}

/**
 * Fired when a time entry is manually logged (without timer).
 */
export function trackTimeEntryLogged(hours: number, workType: string, hasCaseTask: boolean) {
  trackEvent('time_entry_logged', {
    event_category: 'time_tracking',
    event_label: 'Manual Time Entry',
    hours_logged: hours,
    work_type: workType,
    has_case_task: hasCaseTask,
  });
}

/**
 * Fired when a time entry is added to an invoice as a line item.
 */
export function trackTimeEntryBilled(hours: number, invoiceId: string) {
  trackEvent('time_entry_billed', {
    event_category: 'time_tracking',
    event_label: 'Time Entry Added to Invoice',
    hours_billed: hours,
    invoice_id: invoiceId,
  });
}

// ── Retainer Renewal Events ──────────────────────────────────────────────────

/**
 * Fired when the auto-renewal scheduler runs and sends reminder emails.
 */
export function trackAutoRenewalCheck(sent: number, skipped: number, failed: number) {
  trackEvent('retainer_auto_renewal_check', {
    event_category: 'retainer_renewal',
    event_label: 'Auto-Renewal Check Run',
    emails_sent: sent,
    emails_skipped: skipped,
    emails_failed: failed,
  });
}

/**
 * Fired when a manual renewal reminder is sent from the admin dashboard.
 */
export function trackManualRenewalReminder(customerEmail: string, planName: string, daysUntilRenewal: number) {
  trackEvent('retainer_renewal_reminder_sent', {
    event_category: 'retainer_renewal',
    event_label: 'Manual Renewal Reminder',
    plan_name: planName,
    days_until_renewal: daysUntilRenewal,
  });
}

/**
 * Fired when a retainer subscription is cancelled (at period end or immediately).
 */
export function trackRetainerCancellation(planName: string, immediately: boolean) {
  trackEvent('retainer_cancelled', {
    event_category: 'retainer_renewal',
    event_label: immediately ? 'Cancelled Immediately' : 'Cancelled at Period End',
    plan_name: planName,
    cancel_type: immediately ? 'immediate' : 'period_end',
  });
}

// ── Portal Page View Events ──────────────────────────────────────────────────

/**
 * Fired when the client portal dashboard loads.
 */
export function trackPortalDashboardView(caseCount: number, unreadMessages: number) {
  trackEvent('portal_dashboard_view', {
    event_category: 'portal_engagement',
    event_label: 'Portal Dashboard',
    case_count: caseCount,
    unread_messages: unreadMessages,
  });
}

/**
 * Fired when the portal messages page loads.
 */
export function trackPortalMessagesView(messageCount: number, unreadCount: number) {
  trackEvent('portal_messages_view', {
    event_category: 'portal_engagement',
    event_label: 'Portal Messages',
    message_count: messageCount,
    unread_count: unreadCount,
  });
}

/**
 * Fired when a client sends a message in the portal.
 */
export function trackPortalMessageSent(hasAttachment: boolean) {
  trackEvent('portal_message_sent', {
    event_category: 'portal_engagement',
    event_label: 'Message Sent',
    has_attachment: hasAttachment,
  });
}

/**
 * Fired when the portal documents page loads.
 */
export function trackPortalDocumentsView(documentCount: number, pendingSignatures: number) {
  trackEvent('portal_documents_view', {
    event_category: 'portal_engagement',
    event_label: 'Portal Documents',
    document_count: documentCount,
    pending_signatures: pendingSignatures,
  });
}

/**
 * Fired when a client signs a document in the portal.
 */
export function trackPortalDocumentSigned(documentTitle: string) {
  trackEvent('portal_document_signed', {
    event_category: 'portal_engagement',
    event_label: 'Document Signed',
    document_title: documentTitle,
  });
}

/**
 * Fired when the portal retainer tracking page loads.
 */
export function trackPortalRetainerView(planName: string, hoursUsed: number, hoursTotal: number) {
  trackEvent('portal_retainer_view', {
    event_category: 'portal_engagement',
    event_label: 'Portal Retainer Tracking',
    plan_name: planName,
    hours_used: hoursUsed,
    hours_total: hoursTotal,
    utilization_pct: hoursTotal > 0 ? Math.round((hoursUsed / hoursTotal) * 100) : 0,
  });
}

// ── Consultation Funnel Tracking ─────────────────────────────────────────────

/**
 * Step 1 — User lands on the /book-consultation page.
 * Marks funnel entry with traffic source attribution from UTM params.
 */
export function trackConsultationFunnelEntry(params: {
  trafficSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  referrer?: string;
}) {
  trackEvent('consultation_funnel_entry', {
    event_category: 'consultation_funnel',
    funnel_step: 1,
    funnel_step_name: 'page_view',
    traffic_source: params.trafficSource ?? 'direct',
    utm_medium: params.utmMedium ?? '',
    utm_campaign: params.utmCampaign ?? '',
    referrer: (params.referrer ?? '').slice(0, 200),
  });
}

/**
 * Step 2 — User interacts with the Calendly widget (scrolls to it / clicks).
 */
export function trackConsultationCalendlyEngaged(serviceType?: string) {
  trackEvent('consultation_calendly_engaged', {
    event_category: 'consultation_funnel',
    funnel_step: 2,
    funnel_step_name: 'calendly_engaged',
    service_type: serviceType ?? 'general',
  });
}

/**
 * Step 3 — Calendly booking confirmed (event_scheduled postMessage).
 * Primary booking conversion event with service type and traffic source.
 */
export function trackConsultationBooked(params: {
  serviceType: string;
  trafficSource: string;
  utmCampaign?: string;
  hasDeposit?: boolean;
}) {
  trackEvent('consultation_booked', {
    event_category: 'consultation_funnel',
    funnel_step: 3,
    funnel_step_name: 'booking_confirmed',
    service_type: params.serviceType,
    traffic_source: params.trafficSource,
    utm_campaign: params.utmCampaign ?? '',
    has_deposit: !!params.hasDeposit,
  });
  // GA4 recommended conversion event
  trackEvent('generate_lead', {
    form_id: 'consultation_booking',
    source: params.trafficSource,
    service_type: params.serviceType,
  });
}

/**
 * Step 4 — Deposit payment initiated (Stripe intent created).
 * Measures deposit conversion rate within the booking funnel.
 */
export function trackConsultationDepositInitiated(params: {
  serviceType: string;
  trafficSource: string;
  amount: number;
}) {
  trackEvent('consultation_deposit_initiated', {
    event_category: 'consultation_funnel',
    funnel_step: 4,
    funnel_step_name: 'deposit_initiated',
    service_type: params.serviceType,
    traffic_source: params.trafficSource,
    value: params.amount,
    currency: 'USD',
  });
}

/**
 * Step 5 — Deposit payment succeeded.
 * Highest-quality lead signal — paid deposit = committed prospect.
 */
export function trackConsultationDepositPaid(params: {
  serviceType: string;
  trafficSource: string;
  amount: number;
  transactionId: string;
}) {
  trackEvent('consultation_deposit_paid', {
    event_category: 'consultation_funnel',
    funnel_step: 5,
    funnel_step_name: 'deposit_paid',
    service_type: params.serviceType,
    traffic_source: params.trafficSource,
    value: params.amount,
    currency: 'USD',
    transaction_id: params.transactionId,
  });
  // GA4 recommended purchase event
  trackEvent('purchase', {
    transaction_id: params.transactionId,
    value: params.amount,
    currency: 'USD',
    items: [
      {
        item_id: 'consultation_deposit',
        item_name: `Consultation Deposit – ${params.serviceType}`,
        item_category: params.serviceType,
        price: params.amount,
        quantity: 1,
      },
    ],
  });
}

/**
 * Fired when a user abandons the booking funnel (page unload after Calendly engaged
 * but before booking confirmed). Use with beforeunload listener.
 */
export function trackConsultationFunnelAbandonment(lastStep: string, serviceType?: string) {
  trackEvent('consultation_funnel_abandonment', {
    event_category: 'consultation_funnel',
    funnel_step_abandoned: lastStep,
    service_type: serviceType ?? 'unknown',
  });
}

/**
 * Fired when a service type chip/badge is clicked on the book-consultation page.
 * Identifies which service types attract the most booking intent.
 */
export function trackConsultationServiceSelected(serviceType: string, source: string) {
  trackEvent('consultation_service_selected', {
    event_category: 'consultation_funnel',
    service_type: serviceType,
    selection_source: source,
  });
}

/**
 * Helper: reads UTM params and referrer from the current URL.
 * Returns attribution object for use in funnel tracking calls.
 */
export function getTrafficAttribution(): {
  trafficSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  referrer: string;
} {
  if (typeof window === 'undefined') {
    return { trafficSource: 'direct', utmMedium: '', utmCampaign: '', utmContent: '', referrer: '' };
  }
  const params = new URLSearchParams(window.location.search);
  const utmSource = params.get('utm_source') ?? '';
  const utmMedium = params.get('utm_medium') ?? '';
  const utmCampaign = params.get('utm_campaign') ?? '';
  const utmContent = params.get('utm_content') ?? '';
  const referrer = document.referrer ?? '';

  let trafficSource = utmSource;
  if (!trafficSource) {
    if (!referrer) {
      trafficSource = 'direct';
    } else {
      try {
        const host = new URL(referrer).hostname.replace('www.', '');
        if (host.includes('google')) trafficSource = 'google';
        else if (host.includes('bing')) trafficSource = 'bing';
        else if (host.includes('facebook') || host.includes('fb.com')) trafficSource = 'facebook';
        else if (host.includes('linkedin')) trafficSource = 'linkedin';
        else if (host.includes('twitter') || host.includes('x.com')) trafficSource = 'twitter';
        else trafficSource = host;
      } catch {
        trafficSource = 'referral';
      }
    }
  }

  return { trafficSource, utmMedium, utmCampaign, utmContent, referrer };
}

// ── Admin Feature Adoption Tracking ─────────────────────────────────────────

/**
 * Fired every time an admin navigates to a tab in the admin panel.
 * Measures feature adoption — which tabs are visited and how frequently.
 *
 * @param tabId    - Machine-readable tab identifier (e.g. "cases", "payments")
 * @param tabLabel - Human-readable tab label for GA4 display
 */
export function trackAdminTabVisit(tabId: string, tabLabel: string) {
  trackEvent('admin_tab_visit', {
    event_category: 'feature_adoption',
    event_label: tabLabel,
    tab_id: tabId,
    tab_label: tabLabel,
    visited_at: new Date().toISOString(),
  });
}

/**
 * Fired when an admin performs a key action within a tab.
 * Use to measure which features are actively used vs. just viewed.
 *
 * @param action   - Action identifier (e.g. "create_case", "send_invoice", "log_hours")
 * @param tabId    - Tab where the action occurred
 * @param metadata - Optional key/value pairs for additional context
 */
export function trackAdminAction(action: string, tabId: string, metadata?: Record<string, unknown>) {
  trackEvent('admin_action', {
    event_category: 'feature_adoption',
    event_label: action,
    action_name: action,
    tab_id: tabId,
    ...metadata,
  });
}

// ── Workflow Conversion Funnel: Leads → Cases → Payments ─────────────────────

/**
 * Step 1 of the workflow funnel — a new lead/inquiry arrives.
 * Fired when a contact inquiry is created (website form, chatbot, etc.).
 *
 * @param source      - How the lead arrived: "contact_form" | "chatbot" | "calendly" | "manual"
 * @param serviceType - Service area the lead is interested in
 * @param inquiryId   - Supabase inquiry ID for cross-referencing
 */
export function trackWorkflowLeadCreated(params: {
  source: 'contact_form' | 'chatbot' | 'calendly' | 'manual' | string;
  serviceType?: string;
  inquiryId?: string;
}) {
  trackEvent('workflow_lead_created', {
    event_category: 'workflow_funnel',
    funnel_step: 1,
    funnel_step_name: 'lead_created',
    event_label: `Lead – ${params.source}`,
    lead_source: params.source,
    service_type: params.serviceType ?? 'unknown',
    inquiry_id: params.inquiryId ?? '',
  });
}

/**
 * Step 2 — a lead is converted into an active case record.
 * Fired when admin creates a case from an inquiry or manually.
 *
 * @param caseId      - Supabase case/inquiry ID
 * @param serviceType - Service area for the case
 * @param source      - Origin of the case: "inquiry_conversion" | "manual" | "calendly"
 */
export function trackWorkflowCaseCreated(params: {
  caseId: string;
  serviceType?: string;
  source?: string;
}) {
  trackEvent('workflow_case_created', {
    event_category: 'workflow_funnel',
    funnel_step: 2,
    funnel_step_name: 'case_created',
    event_label: 'Lead → Case',
    case_id: params.caseId,
    service_type: params.serviceType ?? 'unknown',
    conversion_source: params.source ?? 'unknown',
  });
}

/**
 * Step 3 — a case progresses to an active/engaged stage.
 * Fired when a case booking_stage changes to a meaningful milestone
 * (e.g. "consultation_scheduled", "retainer_signed", "active").
 *
 * @param caseId    - Supabase case ID
 * @param stage     - New stage name
 * @param prevStage - Previous stage (for drop-off analysis)
 */
export function trackWorkflowCaseProgressed(params: {
  caseId: string;
  stage: string;
  prevStage?: string;
  serviceType?: string;
}) {
  trackEvent('workflow_case_progressed', {
    event_category: 'workflow_funnel',
    funnel_step: 3,
    funnel_step_name: 'case_progressed',
    event_label: `Case Stage: ${params.stage}`,
    case_id: params.caseId,
    new_stage: params.stage,
    previous_stage: params.prevStage ?? 'unknown',
    service_type: params.serviceType ?? 'unknown',
  });
}

/**
 * Step 4 — a payment is initiated for a case (invoice issued or retainer started).
 * Fired when an invoice is created or a retainer subscription begins.
 *
 * @param caseId      - Linked case/inquiry ID
 * @param paymentType - "invoice" | "retainer" | "deposit" | "installment"
 * @param amount      - Payment amount in USD
 */
export function trackWorkflowPaymentInitiated(params: {
  caseId?: string;
  paymentType: 'invoice' | 'retainer' | 'deposit' | 'installment' | string;
  amount: number;
}) {
  trackEvent('workflow_payment_initiated', {
    event_category: 'workflow_funnel',
    funnel_step: 4,
    funnel_step_name: 'payment_initiated',
    event_label: `Payment Initiated – ${params.paymentType}`,
    case_id: params.caseId ?? '',
    payment_type: params.paymentType,
    value: params.amount,
    currency: 'USD',
  });
}

/**
 * Step 5 — payment is successfully collected. Final funnel conversion.
 * Fired when a Stripe payment succeeds for any case-linked payment.
 *
 * @param caseId         - Linked case/inquiry ID
 * @param paymentType    - "invoice" | "retainer" | "deposit" | "installment"
 * @param amount         - Amount collected in USD
 * @param transactionId  - Stripe payment intent or invoice ID
 */
export function trackWorkflowPaymentCollected(params: {
  caseId?: string;
  paymentType: 'invoice' | 'retainer' | 'deposit' | 'installment' | string;
  amount: number;
  transactionId: string;
}) {
  trackEvent('workflow_payment_collected', {
    event_category: 'workflow_funnel',
    funnel_step: 5,
    funnel_step_name: 'payment_collected',
    event_label: `Payment Collected – ${params.paymentType}`,
    case_id: params.caseId ?? '',
    payment_type: params.paymentType,
    value: params.amount,
    currency: 'USD',
    transaction_id: params.transactionId,
  });
  // GA4 recommended purchase event for full funnel attribution
  trackEvent('purchase', {
    transaction_id: params.transactionId,
    value: params.amount,
    currency: 'USD',
    items: [
      {
        item_id: params.paymentType,
        item_name: `Case Payment – ${params.paymentType}`,
        item_category: 'workflow_conversion',
        price: params.amount,
        quantity: 1,
      },
    ],
  });
}

/**
 * Fired when a bottleneck is detected — a case has been in the same stage
 * for longer than expected. Use to identify workflow inefficiencies.
 *
 * @param caseId       - Stalled case ID
 * @param stage        - Current stuck stage
 * @param daysStalled  - Number of days without progression
 * @param serviceType  - Service area for segmentation
 */
export function trackWorkflowBottleneck(params: {
  caseId: string;
  stage: string;
  daysStalled: number;
  serviceType?: string;
}) {
  trackEvent('workflow_bottleneck', {
    event_category: 'workflow_funnel',
    event_label: `Bottleneck: ${params.stage}`,
    case_id: params.caseId,
    stalled_stage: params.stage,
    days_stalled: params.daysStalled,
    service_type: params.serviceType ?? 'unknown',
  });
}

// ── Portal Adoption & Engagement Events ─────────────────────────────────────

/**
 * Fired when a client successfully uploads a document in the portal.
 * Tracks category and file type to identify upload patterns.
 */
export function trackPortalDocumentUpload(params: {
  category: string;
  fileType: string;
  fileSizeBytes: number;
}) {
  trackEvent('portal_document_upload', {
    event_category: 'portal_engagement',
    event_label: 'Portal Document Upload',
    upload_category: params.category,
    file_type: params.fileType,
    file_size_kb: Math.round(params.fileSizeBytes / 1024),
  });
}

/**
 * Fired when a client downloads an invoice PDF from the portal.
 * Distinguishes between payment receipts and client invoices.
 */
export function trackPortalInvoiceDownload(params: {
  invoiceType: 'payment_receipt' | 'client_invoice';
  invoiceNumber?: string;
  amount?: number;
}) {
  trackEvent('portal_invoice_download', {
    event_category: 'portal_engagement',
    event_label: 'Portal Invoice Download',
    invoice_type: params.invoiceType,
    invoice_number: params.invoiceNumber ?? '',
    amount: params.amount ?? 0,
    currency: 'USD',
  });
}

/**
 * Fired when a client submits the portal intake questionnaire.
 * Measures portal form completion rate.
 */
export function trackPortalFormSubmit(params: {
  formType: 'intake_questionnaire' | 'intake_form' | string;
  serviceType?: string;
}) {
  trackEvent('portal_form_submit', {
    event_category: 'portal_engagement',
    event_label: 'Portal Form Submitted',
    form_type: params.formType,
    service_type: params.serviceType ?? 'unknown',
  });
  // GA4 recommended conversion event
  trackEvent('generate_lead', {
    form_id: `portal_${params.formType}`,
    service_type: params.serviceType ?? 'unknown',
    source: 'client_portal',
  });
}

/**
 * Fired when a client views the portal invoices page.
 * Measures invoice page engagement.
 */
export function trackPortalInvoicesView(params: {
  invoiceCount: number;
  outstandingCount: number;
  totalOutstanding: number;
}) {
  trackEvent('portal_invoices_view', {
    event_category: 'portal_engagement',
    event_label: 'Portal Invoices Page',
    invoice_count: params.invoiceCount,
    outstanding_count: params.outstandingCount,
    total_outstanding: params.totalOutstanding,
  });
}

// ── Services → Booking Conversion Funnel ─────────────────────────────────────

/**
 * Funnel Step 1 — User lands on the services page.
 * Captures the referrer source so we know which channel drove the visit.
 */
export function trackServicesFunnelEntry(params: {
  referrerSource: 'homepage' | 'direct' | 'external' | 'other';
  referrerPath?: string;
}) {
  trackEvent('services_funnel_entry', {
    event_category: 'services_booking_funnel',
    funnel_step: 1,
    funnel_step_name: 'services_page',
    referrer_source: params.referrerSource,
    referrer_path: params.referrerPath ?? '',
  });
}

/**
 * Funnel Step 2 — User clicks a service card on the services page.
 * Captures which specific service drove the most booking intent.
 */
export function trackServiceCardFunnelClick(serviceName: string) {
  trackEvent('services_funnel_card_click', {
    event_category: 'services_booking_funnel',
    funnel_step: 2,
    funnel_step_name: 'service_card_clicked',
    service_name: serviceName,
    page: 'services',
  });
  // Store the originating service in sessionStorage for attribution on confirmation page
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem('funnel_origin_service', serviceName);
      sessionStorage.setItem('funnel_origin_cta', 'service_card');
    } catch {
      // sessionStorage unavailable — non-blocking
    }
  }
}

/**
 * Funnel Step 2 (CTA variant) — User clicks a named CTA button on the services page.
 * Captures which CTA (e.g. "Schedule a Consultation", "Email Direct") converts highest.
 */
export function trackServicesCTAFunnelClick(ctaLabel: string, ctaPosition: 'hero' | 'work_cta' | 'process' | 'other') {
  trackEvent('services_funnel_cta_click', {
    event_category: 'services_booking_funnel',
    funnel_step: 2,
    funnel_step_name: 'services_cta_clicked',
    cta_label: ctaLabel,
    cta_position: ctaPosition,
    page: 'services',
  });
  // Store the originating CTA in sessionStorage for attribution on confirmation page
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem('funnel_origin_cta', ctaLabel);
      sessionStorage.setItem('funnel_origin_page', 'services');
    } catch {
      // sessionStorage unavailable — non-blocking
    }
  }
}

/**
 * Funnel Step 3 — User reaches the booking page (book-consultation or schedule).
 * Reads sessionStorage to attribute which services-page CTA drove the visit.
 */
export function trackBookingPageFunnelEntry(bookingPage: 'book_consultation' | 'schedule' | 'prospect_booking') {
  let originService = '';
  let originCta = '';
  let originPage = '';
  if (typeof window !== 'undefined') {
    try {
      originService = sessionStorage.getItem('funnel_origin_service') ?? '';
      originCta = sessionStorage.getItem('funnel_origin_cta') ?? '';
      originPage = sessionStorage.getItem('funnel_origin_page') ?? '';
    } catch {
      // sessionStorage unavailable
    }
  }
  trackEvent('services_funnel_booking_page', {
    event_category: 'services_booking_funnel',
    funnel_step: 3,
    funnel_step_name: 'booking_page_reached',
    booking_page: bookingPage,
    origin_service: originService,
    origin_cta: originCta,
    origin_page: originPage || 'unknown',
  });
}

/**
 * Funnel Step 4 — Booking confirmed (Calendly or direct scheduler).
 * Reads sessionStorage to attribute which services-page CTA and service card converted.
 */
export function trackServicesFunnelBookingConfirmed(params: {
  bookingSource: 'calendly' | 'direct_scheduler' | 'prospect_booking';
  serviceType?: string;
}) {
  let originService = '';
  let originCta = '';
  if (typeof window !== 'undefined') {
    try {
      originService = sessionStorage.getItem('funnel_origin_service') ?? '';
      originCta = sessionStorage.getItem('funnel_origin_cta') ?? '';
    } catch {
      // sessionStorage unavailable
    }
  }
  trackEvent('services_funnel_booking_confirmed', {
    event_category: 'services_booking_funnel',
    funnel_step: 4,
    funnel_step_name: 'booking_confirmed',
    booking_source: params.bookingSource,
    service_type: params.serviceType ?? originService ?? 'unknown',
    origin_service: originService,
    origin_cta: originCta,
  });
}

/**
 * Funnel Step 5 — Payment / booking confirmation page reached.
 * This is the terminal conversion event for the services → booking funnel.
 * Reads sessionStorage to attribute which services-page CTA and service card converted.
 */
export function trackServicesFunnelConversionComplete(params: {
  paymentType: string;
  amount: number;
  transactionId: string;
}) {
  let originService = '';
  let originCta = '';
  if (typeof window !== 'undefined') {
    try {
      originService = sessionStorage.getItem('funnel_origin_service') ?? '';
      originCta = sessionStorage.getItem('funnel_origin_cta') ?? '';
      // Clear funnel attribution after conversion
      sessionStorage.removeItem('funnel_origin_service');
      sessionStorage.removeItem('funnel_origin_cta');
      sessionStorage.removeItem('funnel_origin_page');
    } catch {
      // sessionStorage unavailable
    }
  }
  trackEvent('services_funnel_conversion_complete', {
    event_category: 'services_booking_funnel',
    funnel_step: 5,
    funnel_step_name: 'conversion_complete',
    payment_type: params.paymentType,
    value: params.amount,
    currency: 'USD',
    transaction_id: params.transactionId,
    origin_service: originService,
    origin_cta: originCta,
  });
}

// ── Lexi Assistant Engagement & ROI Tracking ─────────────────────────────────

/**
 * Fired when the Lexi chat panel is opened for the first time in a session.
 * Measures conversation start rate (opens / page views).
 */
export function trackAssistantConversationStart(source: string = 'floating_chat') {
  trackEvent('assistant_conversation_start', {
    event_category: 'assistant_engagement',
    event_label: 'Conversation Started',
    assistant_source: source,
  });
}

/**
 * Fired each time the user sends a message to Lexi.
 * Use messageCount to track depth of engagement per session.
 */
export function trackAssistantMessageSent(params: {
  messageCount: number;
  source?: string;
}) {
  trackEvent('assistant_message_sent', {
    event_category: 'assistant_engagement',
    event_label: 'User Message',
    message_count: params.messageCount,
    assistant_source: params.source ?? 'floating_chat',
  });
}

/**
 * Fired when the chat is closed or the session ends (component unmounts while open).
 * Captures total message count and session duration for ROI measurement.
 */
export function trackAssistantSessionEnd(params: {
  messageCount: number;
  sessionDurationSeconds: number;
  source?: string;
}) {
  trackEvent('assistant_session_end', {
    event_category: 'assistant_engagement',
    event_label: 'Session Ended',
    message_count: params.messageCount,
    session_duration_seconds: params.sessionDurationSeconds,
    assistant_source: params.source ?? 'floating_chat',
  });
}

/**
 * Fired when the user asks about a specific legal topic.
 * Extracts the first meaningful keyword from the query to measure topic distribution.
 * Helps identify which legal topics drive the most assistant engagement.
 */
export function trackAssistantQueryTopic(params: {
  query: string;
  messageCount: number;
  source?: string;
}) {
  // Classify query into a broad topic bucket for GA4 reporting
  const q = params.query.toLowerCase();
  let topic = 'general';
  if (/contract|agreement|clause|review/.test(q)) topic = 'contract_review';
  else if (/litigation|lawsuit|court|trial|deposition/.test(q)) topic = 'litigation_support';
  else if (/research|case law|statute|precedent/.test(q)) topic = 'legal_research';
  else if (/document|draft|template|letter/.test(q)) topic = 'document_drafting';
  else if (/case|manage|status|timeline/.test(q)) topic = 'case_management';
  else if (/price|cost|fee|retainer|pay/.test(q)) topic = 'pricing';
  else if (/book|consult|appointment|schedule|availability/.test(q)) topic = 'booking_intent';
  else if (/paralegal|attorney|lawyer|firm/.test(q)) topic = 'firm_info';

  trackEvent('assistant_query_topic', {
    event_category: 'assistant_engagement',
    event_label: topic,
    query_topic: topic,
    message_count: params.messageCount,
    assistant_source: params.source ?? 'floating_chat',
  });
}

/**
 * Fired when the user clicks the "Book a Free Consultation" CTA inside the chat.
 * Measures assistant-to-booking conversion rate (key ROI signal).
 */
export function trackAssistantBookingCTAClick(messageCount: number) {
  trackEvent('assistant_booking_cta_click', {
    event_category: 'assistant_roi',
    event_label: 'Chat → Booking CTA',
    message_count: messageCount,
    assistant_source: 'floating_chat',
  });
}