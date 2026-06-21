/**
 * triggerEventNotification — call this from any server-side code or API route
 * to fire an event-driven client notification (email + optional SMS) based on
 * admin-configured templates.
 *
 * The function checks the notification_event_config table to see if the event
 * is enabled before sending. If disabled, it silently skips.
 *
 * @example
 * await triggerEventNotification('document_sent', 'jane@example.com', 'Jane Smith', {
 *   caseName: 'Smith v. Jones',
 *   documentName: 'Retainer Agreement.pdf',
 * });
 *
 * // With SMS:
 * await triggerEventNotification('invoice_issued', 'jane@example.com', 'Jane Smith', {
 *   invoiceNumber: 'INV-001', amount: '1,500.00', dueDate: 'July 1, 2026',
 * }, '+15551234567');
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://broussardlegalservices.com';

export async function triggerEventNotification(
  eventKey: string,
  clientEmail: string,
  clientName: string,
  variables: Record<string, string> = {},
  clientPhone?: string
): Promise<{ success: boolean; skipped?: boolean; error?: string; emailStatus?: string; smsStatus?: string }> {
  try {
    const baseUrl = typeof window !== 'undefined' ? '' : SITE_URL;
    const res = await fetch(`${baseUrl}/api/notifications/trigger-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventKey, clientEmail, clientName, clientPhone, variables }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.warn(`[triggerEventNotification] Failed for event "${eventKey}":`, data.error);
      return { success: false, error: data.error };
    }

    if (data.skipped) {
      return { success: true, skipped: true };
    }

    return { success: true, emailStatus: data.emailStatus, smsStatus: data.smsStatus };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.warn(`[triggerEventNotification] Exception for event "${eventKey}":`, msg);
    return { success: false, error: msg };
  }
}

/**
 * Convenience wrappers for common events
 */

export async function notifyDocumentSent(
  clientEmail: string,
  clientName: string,
  caseName: string,
  documentName: string,
  clientPhone?: string
) {
  return triggerEventNotification('document_sent', clientEmail, clientName, { caseName, documentName }, clientPhone);
}

export async function notifyCaseStatusUpdated(
  clientEmail: string,
  clientName: string,
  caseName: string,
  newStatus: string,
  updateNotes = '',
  clientPhone?: string
) {
  return triggerEventNotification('case_status_updated', clientEmail, clientName, {
    caseName,
    newStatus,
    updateNotes,
  }, clientPhone);
}

export async function notifyCaseNoteAdded(
  clientEmail: string,
  clientName: string,
  caseName: string,
  noteContent: string,
  clientPhone?: string
) {
  return triggerEventNotification('case_note_added', clientEmail, clientName, { caseName, noteContent }, clientPhone);
}

export async function notifyInvoiceIssued(
  clientEmail: string,
  clientName: string,
  invoiceNumber: string,
  amount: string,
  dueDate: string,
  clientPhone?: string
) {
  return triggerEventNotification('invoice_issued', clientEmail, clientName, {
    invoiceNumber,
    amount,
    dueDate,
  }, clientPhone);
}

export async function notifyInvoiceOverdue(
  clientEmail: string,
  clientName: string,
  invoiceNumber: string,
  amount: string,
  dueDate: string,
  clientPhone?: string
) {
  return triggerEventNotification('invoice_overdue', clientEmail, clientName, {
    invoiceNumber,
    amount,
    dueDate,
  }, clientPhone);
}

export async function notifyInvoicePaid(
  clientEmail: string,
  clientName: string,
  invoiceNumber: string,
  amount: string,
  clientPhone?: string
) {
  return triggerEventNotification('invoice_paid', clientEmail, clientName, { invoiceNumber, amount }, clientPhone);
}

export async function notifySignatureRequested(
  clientEmail: string,
  clientName: string,
  documentName: string,
  clientPhone?: string
) {
  return triggerEventNotification('document_signature_requested', clientEmail, clientName, { documentName }, clientPhone);
}

export async function notifyCaseClosed(
  clientEmail: string,
  clientName: string,
  caseName: string,
  clientPhone?: string
) {
  return triggerEventNotification('case_closed', clientEmail, clientName, { caseName }, clientPhone);
}

// ── New event wrappers ────────────────────────────────────────────────────────

export async function notifyAppointmentConfirmed(
  clientEmail: string,
  clientName: string,
  appointmentType: string,
  appointmentDate: string,
  appointmentTime: string,
  clientPhone?: string
) {
  return triggerEventNotification('appointment_confirmed', clientEmail, clientName, {
    appointmentType,
    appointmentDate,
    appointmentTime,
  }, clientPhone);
}

export async function notifyAppointmentReminder(
  clientEmail: string,
  clientName: string,
  appointmentType: string,
  appointmentDate: string,
  appointmentTime: string,
  clientPhone?: string
) {
  return triggerEventNotification('appointment_reminder', clientEmail, clientName, {
    appointmentType,
    appointmentDate,
    appointmentTime,
  }, clientPhone);
}

export async function notifyRetainerRenewalDue(
  clientEmail: string,
  clientName: string,
  retainerName: string,
  renewalDate: string,
  amount: string,
  clientPhone?: string
) {
  return triggerEventNotification('retainer_renewal_due', clientEmail, clientName, {
    retainerName,
    renewalDate,
    amount,
  }, clientPhone);
}

export async function notifyDocumentApproved(
  clientEmail: string,
  clientName: string,
  caseName: string,
  documentName: string,
  clientPhone?: string
) {
  return triggerEventNotification('document_approved', clientEmail, clientName, { caseName, documentName }, clientPhone);
}

export async function notifyIntakeReceived(
  clientEmail: string,
  clientName: string,
  caseName: string,
  clientPhone?: string
) {
  return triggerEventNotification('intake_received', clientEmail, clientName, { caseName }, clientPhone);
}

export async function notifyPaymentPlanCreated(
  clientEmail: string,
  clientName: string,
  planName: string,
  totalAmount: string,
  installmentCount: string,
  installmentAmount: string,
  firstPaymentDate: string,
  clientPhone?: string
) {
  return triggerEventNotification('payment_plan_created', clientEmail, clientName, {
    planName,
    totalAmount,
    installmentCount,
    installmentAmount,
    firstPaymentDate,
  }, clientPhone);
}
