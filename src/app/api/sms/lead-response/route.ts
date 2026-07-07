import { NextRequest, NextResponse } from 'next/server';
import { sendLeadResponseSMS } from '@/lib/twilio/smsClient';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/sms/lead-response
 * Sends an instant SMS to a new contact form submission while the lead is warm.
 * Called fire-and-forget from /api/contact/submit after DB insert.
 */
export async function POST(req: NextRequest) {
  try {
    const { to, clientName, service, inquiryId } = await req.json();

    if (!to || !clientName) {
      return NextResponse.json({ error: 'Missing required fields: to, clientName' }, { status: 400 });
    }

    const result = await sendLeadResponseSMS({ to, clientName, service: service ?? 'paralegal services' });

    // Log to sms_reminder_logs (non-blocking)
    try {
      const supabase = await createClient();
      await supabase.from('sms_reminder_logs').insert({
        recipient_name: clientName,
        recipient_phone: to,
        recipient_type: 'client',
        message_type: 'lead_response',
        message_body: `Lead response SMS sent to ${clientName} for service: ${service ?? 'general'}`,
        status: result.success ? 'sent' : 'failed',
        error: result.success ? null : result.error,
        inquiry_id: inquiryId ?? null,
        trigger_type: 'contact_form',
      });
    } catch {
      // Non-blocking — logging failure must not break the response
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, messageSid: result.messageSid });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[/api/sms/lead-response] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
