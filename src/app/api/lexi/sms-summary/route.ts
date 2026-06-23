import { NextRequest, NextResponse } from 'next/server';
import { sendSMS } from '@/lib/twilio/smsClient';

/**
 * POST /api/lexi/sms-summary
 * Sends a Lexi conversation summary via SMS to the client
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { to, clientName, summary, sessionKey } = body as {
      to: string;
      clientName: string;
      summary: string;
      sessionKey?: string;
    };

    if (!to || !clientName || !summary) {
      return NextResponse.json({ error: 'Missing required fields: to, clientName, summary' }, { status: 400 });
    }

    const firstName = clientName.split(' ')[0];
    const portalUrl = 'https://broussardlegalservices.com/portal/dashboard';

    const message =
      `Broussard Legal Services\n\n` +
      `Hi ${firstName}, here's a summary of your Lexi conversation:\n\n` +
      `${summary.slice(0, 400)}${summary.length > 400 ? '...' : ''}\n\n` +
      `View your full case details: ${portalUrl}\n\n` +
      `Reply STOP to opt out.`;

    const result = await sendSMS(to, message);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, messageSid: result.messageSid });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[/api/lexi/sms-summary] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
