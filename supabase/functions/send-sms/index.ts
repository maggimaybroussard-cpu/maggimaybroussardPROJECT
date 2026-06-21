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

async function sendSMS(to: string, body: string): Promise<{ success: boolean; messageSid?: string; error?: string }> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    return { success: false, error: 'Twilio credentials not configured' };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

  const formData = new URLSearchParams({ To: to, From: TWILIO_PHONE_NUMBER, Body: body });

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
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, to, ...params } = await req.json();

    if (!type || !to) {
      return new Response(JSON.stringify({ error: 'Missing required fields: type, to' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let messageBody = '';
    const SITE_URL = 'https://broussardlegalservices.com';

    switch (type) {
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
          ? `Maggi May Broussard Legal Services\n\nHi ${firstName}, invoice #${invoiceNumber} for ${amount} is OVERDUE (was due ${dueDate}). Please pay now: ${portalUrl}\n\nReply STOP to opt out.`
          : `Maggi May Broussard Legal Services\n\nHi ${firstName}, a friendly reminder that invoice #${invoiceNumber} for ${amount} is due on ${dueDate}. Pay securely: ${portalUrl}\n\nReply STOP to opt out.`;
        break;
      }

      case 'appointment_reminder': {
        const { clientName, eventName, eventDate, eventTime, reminderType } = params;
        if (!clientName || !eventDate || !eventTime || !reminderType) throw new Error('Missing appointment reminder fields');
        const firstName = clientName.split(' ')[0];
        const consultation = eventName ?? 'Paralegal Consultation';
        messageBody = reminderType === '24hr'
          ? `Maggi May Broussard Legal Services\n\nHi ${firstName}, reminder: your ${consultation} is TOMORROW at ${eventTime} (${eventDate}).\n\nNeed to reschedule? Use your Calendly confirmation link.\n\nReply STOP to opt out.`
          : `Maggi May Broussard Legal Services\n\nHi ${firstName}, your ${consultation} starts in 1 HOUR at ${eventTime}. Please make sure you're ready to connect.\n\nReply STOP to opt out.`;
        break;
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown SMS type: ${type}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const result = await sendSMS(to, messageBody);

    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, messageSid: result.messageSid }), {
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
