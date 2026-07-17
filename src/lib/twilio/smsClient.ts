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

// ─── WhatsApp Functions ───────────────────────────────────────────────────────

type TwilioResult = { success: true; sid: string } | { success: false; error: any };

function getWhatsAppAuthHeader(): string {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error('Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN');
  return `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`;
}

/**
 * Send a WhatsApp message via Twilio
 */
export async function sendWhatsApp(to: string, body: string): Promise<TwilioResult> {
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!from) return { success: false, error: 'Missing TWILIO_PHONE_NUMBER' };

  const url = `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`;
  const params = new URLSearchParams({
    From: `whatsapp:${from}`,
    To: `whatsapp:${to}`,
    Body: body,
  });

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: getWhatsAppAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const json = await res.json();
    return res.ok ? { success: true, sid: json.sid } : { success: false, error: json };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Send a consultation reminder via WhatsApp
 */
export function sendConsultationReminderWhatsApp(
  to: string,
  { date, time }: { date: string; time: string }
): Promise<TwilioResult> {
  const msg = `Reminder: Your consultation is scheduled for ${date} at ${time}. Reply or visit your portal to reschedule.`;
  return sendWhatsApp(to, msg);
}

/**
 * Send a case update notification via WhatsApp
 */
export function sendCaseUpdateWhatsApp(
  to: string,
  { caseId, summary }: { caseId: string; summary: string }
): Promise<TwilioResult> {
  const msg = `Update for case ${caseId}: ${summary}. Check your portal for details.`;
  return sendWhatsApp(to, msg);
}

/**
 * Send a payment reminder via WhatsApp
 */
export function sendPaymentReminderWhatsApp(
  to: string,
  { amount, dueDate }: { amount: string; dueDate: string }
): Promise<TwilioResult> {
  const msg = `Payment reminder: ${amount} due on ${dueDate}. Pay via your client portal or contact us for assistance.`;
  return sendWhatsApp(to, msg);
}

/**
 * Send a generic client notification via WhatsApp
 */
export function sendClientNotificationWhatsApp(
  to: string,
  message: string
): Promise<TwilioResult> {
  return sendWhatsApp(to, message);
}
