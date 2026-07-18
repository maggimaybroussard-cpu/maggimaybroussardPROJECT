import { NextRequest, NextResponse } from 'next/server';
import { sendSMS } from '@/lib/twilio/smsClient';

/**
 * POST /api/sms/case-update
 * Sends a case update SMS to a client via Twilio.
 * Body: { to: string, clientName: string, caseId: string, updateType: string, summary: string, portalUrl?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      to,
      clientName,
      caseId,
      updateType = 'Case Update',
      summary,
      portalUrl,
    } = body as {
      to: string;
      clientName: string;
      caseId?: string;
      updateType?: string;
      summary: string;
      portalUrl?: string;
    };

    if (!to || !clientName || !summary) {
      return NextResponse.json(
        { error: 'Missing required fields: to, clientName, summary' },
        { status: 400 }
      );
    }

    const firstName = clientName.split(' ')[0];
    const portal = portalUrl ?? `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://broussardlegalservices.com'}/portal/dashboard`;
    const caseRef = caseId ? ` (Case #${caseId})` : '';

    const message =
      `Broussard Legal Services\n\n` +
      `Hi ${firstName}, you have a ${updateType}${caseRef}:\n\n` +
      `${summary}\n\n` +
      `View details in your portal: ${portal}\n\n` +
      `Reply STOP to opt out.`;

    const result = await sendSMS(to, message);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, messageSid: result.messageSid });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[/api/sms/case-update] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
