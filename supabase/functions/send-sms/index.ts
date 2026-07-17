// @ts-ignore: Deno global is available in Supabase Edge Functions runtime
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Promise<Response>): void;
};

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
};

// ─── Twilio helpers ───────────────────────────────────────────────────────────

function twilioCredentials() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) return null;
  return {
    sid: TWILIO_ACCOUNT_SID,
    token: TWILIO_AUTH_TOKEN,
    phone: TWILIO_PHONE_NUMBER,
    credentials: btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
    url: `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
  };
}

async function sendSMS(to: string, body: string): Promise<{ success: boolean; messageSid?: string; error?: string }> {
  const creds = twilioCredentials();
  if (!creds) return { success: false, error: 'Twilio credentials not configured' };

  const formData = new URLSearchParams({ To: to, From: creds.phone, Body: body });
  const response = await fetch(creds.url, {
    method: 'POST',
    headers: { Authorization: `Basic ${creds.credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  });
  const data = await response.json();
  if (!response.ok) return { success: false, error: data?.message ?? 'Twilio API error' };
  return { success: true, messageSid: data.sid };
}

async function sendWhatsApp(to: string, body: string): Promise<{ success: boolean; messageSid?: string; error?: string }> {
  const creds = twilioCredentials();
  if (!creds) return { success: false, error: 'Twilio credentials not configured' };

  const formData = new URLSearchParams({
    To: `whatsapp:${to}`,
    From: `whatsapp:${creds.phone}`,
    Body: body,
  });
  const response = await fetch(creds.url, {
    method: 'POST',
    headers: { Authorization: `Basic ${creds.credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  });
  const data = await response.json();
  if (!response.ok) return { success: false, error: data?.message ?? 'Twilio WhatsApp API error' };
  return { success: true, messageSid: data.sid };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, to, channel, ...params } = await req.json();

    if (!type || !to) {
      return new Response(JSON.stringify({ error: 'Missing required fields: type, to' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // channel: 'sms' (default) | 'whatsapp'
    const useWhatsApp = channel === 'whatsapp' || type.startsWith('whatsapp_');

    let messageBody = '';
    const SITE_URL = 'https://broussardlegalservices.com';

    // Normalise type — strip 'whatsapp_' prefix so the same switch handles both channels
    const normalizedType = type.startsWith('whatsapp_') ? type.replace('whatsapp_', '') : type;

    switch (normalizedType) {
      case 'mfa': {
        const { code } = params;
        if (!code) throw new Error('Missing code for MFA SMS');
        messageBody = `Maggi May Broussard Legal Services\n\nYour verification code is: ${code}\n\nThis code expires in 10 minutes. Do not share it with anyone.`;
        break;
      }

      case 'payment_reminder': {
        const { clientName, invoiceNumber, amount, dueDate, paymentLink, isOverdue } = params;
        if (!clientName || !invoiceNumber || !amount || !dueDate) throw new Error('Missing payment reminder fields');
        const firstName = clientName.split(' ')[0];
        const portalUrl = paymentLink ?? `${SITE_URL}/portal/invoices`;
        messageBody = isOverdue
          ? `Maggi May Broussard Legal Services\n\nHi ${firstName}, invoice #${invoiceNumber} for ${amount} is OVERDUE (was due ${dueDate}). Please pay now: ${portalUrl}`
          : `Maggi May Broussard Legal Services\n\nHi ${firstName}, a friendly reminder that invoice #${invoiceNumber} for ${amount} is due on ${dueDate}. Pay securely: ${portalUrl}`;
        if (!useWhatsApp) messageBody += '\n\nReply STOP to opt out.';
        break;
      }

      case 'appointment_reminder': {
        const { clientName, eventName, eventDate, eventTime, reminderType } = params;
        if (!clientName || !eventDate || !eventTime || !reminderType) throw new Error('Missing appointment reminder fields');
        const firstName = clientName.split(' ')[0];
        const consultation = eventName ?? 'Paralegal Consultation';
        messageBody = reminderType === '24hr'
          ? `Maggi May Broussard Legal Services\n\nHi ${firstName}, reminder: your ${consultation} is TOMORROW at ${eventTime} (${eventDate}).\n\nNeed to reschedule? Use your Calendly confirmation link.`
          : `Maggi May Broussard Legal Services\n\nHi ${firstName}, your ${consultation} starts in 1 HOUR at ${eventTime}. Please make sure you're ready to connect.`;
        if (!useWhatsApp) messageBody += '\n\nReply STOP to opt out.';
        break;
      }

      case 'consultation_reminder': {
        const { date, time } = params;
        if (!date || !time) throw new Error('Missing date/time for consultation reminder');
        messageBody = `Broussard Legal Services\n\nReminder: Your consultation is scheduled for ${date} at ${time}. Reply or visit your portal to reschedule: ${SITE_URL}/portal/dashboard`;
        break;
      }

      case 'case_update': {
        const { caseId, summary } = params;
        if (!caseId || !summary) throw new Error('Missing caseId/summary for case update');
        messageBody = `Broussard Legal Services\n\nUpdate for case ${caseId}: ${summary}\n\nCheck your portal for details: ${SITE_URL}/portal/cases`;
        break;
      }

      case 'notification': {
        const { message } = params;
        if (!message) throw new Error('Missing message for notification');
        messageBody = message;
        break;
      }

      case 'custom': {
        const { message } = params;
        if (!message) throw new Error('Missing message for custom type');
        messageBody = message;
        break;
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown SMS type: ${normalizedType}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const result = useWhatsApp
      ? await sendWhatsApp(to, messageBody)
      : await sendSMS(to, messageBody);

    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, messageSid: result.messageSid, channel: useWhatsApp ? 'whatsapp' : 'sms' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[send-sms] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
