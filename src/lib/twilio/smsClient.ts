/**
 * Twilio SMS Client
 * Handles MFA codes, payment reminders, and appointment reminders
 */

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

export interface SMSResult {
  success: boolean;
  messageSid?: string;
  error?: string;
}

/**
 * Core SMS sender via Twilio REST API
 */
export async function sendSMS(to: string, body: string): Promise<SMSResult> {
  console.log("Log this please");
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    console.error('[Twilio] Missing credentials. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER.');
    return { success: false, error: 'Twilio credentials not configured' };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const credentials = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');

  const formData = new URLSearchParams({
    To: to,
    From: TWILIO_PHONE_NUMBER,
    Body: body,
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Twilio] API error:', data);
      return { success: false, error: data?.message ?? 'Twilio API error' };
    }

    return { success: true, messageSid: data.sid };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Twilio] sendSMS error:', message);
    return { success: false, error: message };
  }
}

/**
 * Send MFA verification code via SMS
 */
export async function sendMFACode(to: string, code: string): Promise<SMSResult> {
  const body = `Maggi May Broussard Legal Services\n\nYour verification code is: ${code}\n\nThis code expires in 10 minutes. Do not share it with anyone.`;
  return sendSMS(to, body);
}

/**
 * Send payment reminder SMS
 */
export async function sendPaymentReminderSMS(opts: {
  to: string;
  clientName: string;
  invoiceNumber: string;
  amount: string;
  dueDate: string;
  paymentLink?: string;
  isOverdue?: boolean;
}): Promise<SMSResult> {
  const firstName = opts.clientName.split(' ')[0];
  const portalUrl = opts.paymentLink ?? 'https://broussardlegalservices.com/portal/invoices';

  const body = opts.isOverdue
    ? `Maggi May Broussard Legal Services\n\nHi ${firstName}, invoice #${opts.invoiceNumber} for ${opts.amount} is OVERDUE (was due ${opts.dueDate}). Please pay now: ${portalUrl}\n\nReply STOP to opt out.`
    : `Maggi May Broussard Legal Services\n\nHi ${firstName}, a friendly reminder that invoice #${opts.invoiceNumber} for ${opts.amount} is due on ${opts.dueDate}. Pay securely: ${portalUrl}\n\nReply STOP to opt out.`;

  return sendSMS(opts.to, body);
}

/**
 * Send appointment reminder SMS
 */
export async function sendAppointmentReminderSMS(opts: {
  to: string;
  clientName: string;
  eventName?: string;
  eventDate: string;
  eventTime: string;
  reminderType: '24hr' | '1hr';
}): Promise<SMSResult> {
  const firstName = opts.clientName.split(' ')[0];
  const consultation = opts.eventName ?? 'Paralegal Consultation';

  const body = opts.reminderType === '24hr'
    ? `Maggi May Broussard Legal Services\n\nHi ${firstName}, reminder: your ${consultation} is TOMORROW at ${opts.eventTime} (${opts.eventDate}).\n\nNeed to reschedule? Use your Calendly confirmation link.\n\nReply STOP to opt out.`
    : `Maggi May Broussard Legal Services\n\nHi ${firstName}, your ${consultation} starts in 1 HOUR at ${opts.eventTime}. Please make sure you're ready to connect.\n\nReply STOP to opt out.`;

  return sendSMS(opts.to, body);
}

/**
 * Send appointment confirmation SMS
 */
export async function sendAppointmentConfirmationSMS(opts: {
  to: string;
  clientName: string;
  appointmentType: string;
  appointmentDate: string;
  appointmentTime: string;
  timezone: string;
}): Promise<SMSResult> {
  const firstName = opts.clientName.split(' ')[0];
  const tzShort = opts.timezone === 'America/Chicago' ? 'CT' :
    opts.timezone === 'America/New_York' ? 'ET' :
    opts.timezone === 'America/Denver' ? 'MT' : 'PT';

  const body = `Broussard Legal Services\n\nHi ${firstName}, your ${opts.appointmentType} is CONFIRMED for ${opts.appointmentDate} at ${opts.appointmentTime} ${tzShort}.\n\nQuestions? Call our office or visit broussardlegalservices.com\n\nReply STOP to opt out.`;
  return sendSMS(opts.to, body);
}

/**
 * Send appointment reschedule SMS
 */
export async function sendAppointmentRescheduleSMS(opts: {
  to: string;
  clientName: string;
  appointmentType: string;
  appointmentDate: string;
  appointmentTime: string;
  timezone: string;
}): Promise<SMSResult> {
  const firstName = opts.clientName.split(' ')[0];
  const tzShort = opts.timezone === 'America/Chicago' ? 'CT' :
    opts.timezone === 'America/New_York' ? 'ET' :
    opts.timezone === 'America/Denver' ? 'MT' : 'PT';

  const body = `Broussard Legal Services\n\nHi ${firstName}, your ${opts.appointmentType} has been RESCHEDULED to ${opts.appointmentDate} at ${opts.appointmentTime} ${tzShort}.\n\nQuestions? Visit broussardlegalservices.com\n\nReply STOP to opt out.`;
  return sendSMS(opts.to, body);
}

/**
 * Send appointment cancellation SMS
 */
export async function sendAppointmentCancellationSMS(opts: {
  to: string;
  clientName: string;
  appointmentType: string;
  appointmentDate: string;
  appointmentTime: string;
}): Promise<SMSResult> {
  const firstName = opts.clientName.split(' ')[0];

  const body = `Broussard Legal Services\n\nHi ${firstName}, your ${opts.appointmentType} scheduled for ${opts.appointmentDate} at ${opts.appointmentTime} has been CANCELLED.\n\nTo rebook, visit broussardlegalservices.com or call our office.\n\nReply STOP to opt out.`;
  return sendSMS(opts.to, body);
}

/**
 * Send appointment reminder SMS (Lexi-triggered)
 */
export async function sendLexiAppointmentReminderSMS(opts: {
  to: string;
  clientName: string;
  appointmentType: string;
  appointmentDate: string;
  appointmentTime: string;
  timezone: string;
}): Promise<SMSResult> {
  const firstName = opts.clientName.split(' ')[0];
  const tzShort = opts.timezone === 'America/Chicago' ? 'CT' :
    opts.timezone === 'America/New_York' ? 'ET' :
    opts.timezone === 'America/Denver' ? 'MT' : 'PT';

  const body = `Broussard Legal Services\n\nHi ${firstName}, this is a reminder about your upcoming ${opts.appointmentType} on ${opts.appointmentDate} at ${opts.appointmentTime} ${tzShort}.\n\nPlease contact us if you need to reschedule.\n\nReply STOP to opt out.`;
  return sendSMS(opts.to, body);
}

/**
 * Send instant lead response SMS when a contact form is submitted
 */
export async function sendLeadResponseSMS(opts: {
  to: string;
  clientName: string;
  service: string;
}): Promise<SMSResult> {
  const firstName = opts.clientName.split(' ')[0];
  const body = `Broussard Legal Services\n\nHi ${firstName}, we received your inquiry about ${opts.service}. Maggi May will personally follow up within 1 business day.\n\nWant to skip the wait? Book a free 30-min consultation: https://broussardlegalservices.com/availability\n\nReply STOP to opt out.`;
  return sendSMS(opts.to, body);
}

/**
 * Send abandoned booking nudge SMS for leads who started but didn't finish booking
 */
export async function sendAbandonedBookingSMS(opts: {
  to: string;
  clientName: string;
  service?: string;
}): Promise<SMSResult> {
  const firstName = opts.clientName.split(' ')[0];
  const serviceNote = opts.service ? ` about ${opts.service}` : '';
  const body = `Broussard Legal Services\n\nHi ${firstName}, you started booking a consultation${serviceNote} but didn't finish. It only takes 2 minutes — grab a time that works for you: https://broussardlegalservices.com/availability\n\nReply STOP to opt out.`;
  return sendSMS(opts.to, body);
}

/**
 * Core WhatsApp sender via Twilio REST API
 */
export async function sendWhatsApp(to: string, body: string): Promise<SMSResult> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    console.error('[Twilio] Missing credentials for WhatsApp.');
    return { success: false, error: 'Twilio credentials not configured' };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const credentials = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');

  const formData = new URLSearchParams({
    To: `whatsapp:${to}`,
    From: `whatsapp:${TWILIO_PHONE_NUMBER}`,
    Body: body,
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Twilio] WhatsApp API error:', data);
      return { success: false, error: data?.message ?? 'Twilio API error' };
    }

    return { success: true, messageSid: data.sid };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Twilio] sendWhatsApp error:', message);
    return { success: false, error: message };
  }
}

/**
 * Send consultation reminder via WhatsApp
 */
export async function sendConsultationReminderWhatsApp(opts: {
  to: string;
  clientName: string;
  appointmentType?: string;
  appointmentDate: string;
  appointmentTime: string;
  meetingLink?: string;
  reminderType: '24hr' | '1hr';
}): Promise<SMSResult> {
  const firstName = opts.clientName.split(' ')[0];
  const consultation = opts.appointmentType ?? 'Consultation';
  const meetingLinkText = opts.meetingLink ? `\n\nJoin here: ${opts.meetingLink}` : '';

  const body = opts.reminderType === '24hr'
    ? `Hi ${firstName}, reminder: your ${consultation} is TOMORROW at ${opts.appointmentTime} (${opts.appointmentDate}).${meetingLinkText}\n\nReply with any questions.`
    : `Hi ${firstName}, your ${consultation} starts in 1 HOUR at ${opts.appointmentTime}.${meetingLinkText}\n\nMake sure you're ready to connect.`;

  return sendWhatsApp(opts.to, body);
}

/**
 * Send case update via WhatsApp
 */
export async function sendCaseUpdateWhatsApp(opts: {
  to: string;
  clientName: string;
  caseName: string;
  updateMessage: string;
  portalLink?: string;
}): Promise<SMSResult> {
  const firstName = opts.clientName.split(' ')[0];
  const portalText = opts.portalLink ? `\n\nView details: ${opts.portalLink}` : '';
  const body = `Hi ${firstName}, update on ${opts.caseName}:\n\n${opts.updateMessage}${portalText}`;

  return sendWhatsApp(opts.to, body);
}

/**
 * Send payment reminder via WhatsApp
 */
export async function sendPaymentReminderWhatsApp(opts: {
  to: string;
  clientName: string;
  invoiceNumber: string;
  amount: string;
  dueDate: string;
  paymentLink?: string;
  isOverdue?: boolean;
}): Promise<SMSResult> {
  const firstName = opts.clientName.split(' ')[0];
  const portalUrl = opts.paymentLink ?? 'https://broussardlegalservices.com/portal/invoices';

  const body = opts.isOverdue
    ? `Hi ${firstName}, invoice #${opts.invoiceNumber} for ${opts.amount} is OVERDUE (was due ${opts.dueDate}).\n\nPay now: ${portalUrl}`
    : `Hi ${firstName}, reminder: invoice #${opts.invoiceNumber} for ${opts.amount} is due on ${opts.dueDate}.\n\nPay securely: ${portalUrl}`;

  return sendWhatsApp(opts.to, body);
}

/**
 * Send client notification via WhatsApp
 */
export async function sendClientNotificationWhatsApp(opts: {
  to: string;
  clientName: string;
  subject: string;
  message: string;
  actionLink?: string;
  actionLabel?: string;
}): Promise<SMSResult> {
  const firstName = opts.clientName.split(' ')[0];
  const actionText = opts.actionLink && opts.actionLabel
    ? `\n\n${opts.actionLabel}: ${opts.actionLink}`
    : '';

  const body = `Hi ${firstName},\n\n${opts.subject}\n\n${opts.message}${actionText}`;

  return sendWhatsApp(opts.to, body);
}
