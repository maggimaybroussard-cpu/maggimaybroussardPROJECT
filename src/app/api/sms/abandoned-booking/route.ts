import { NextRequest, NextResponse } from 'next/server';
import { sendAbandonedBookingSMS } from '@/lib/twilio/smsClient';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/sms/abandoned-booking
 * Sends a single nudge SMS to a lead who started but didn't finish booking.
 * Can be triggered manually from the admin dashboard or by a scheduled job
 * that checks contact_inquiries where booking_stage = 'inquiry' and
 * created_at is between 1–24 hours ago with no calendly_event_uuid.
 *
 * Body: { to, clientName, service?, inquiryId? }
 */
export async function POST(req: NextRequest) {
  try {
    const { to, clientName, service, inquiryId } = await req.json();

    if (!to || !clientName) {
      return NextResponse.json({ error: 'Missing required fields: to, clientName' }, { status: 400 });
    }

    const result = await sendAbandonedBookingSMS({ to, clientName, service });

    // Log to sms_reminder_logs (non-blocking)
    try {
      const supabase = await createClient();
      await supabase.from('sms_reminder_logs').insert({
        recipient_name: clientName,
        recipient_phone: to,
        recipient_type: 'client',
        message_type: 'abandoned_booking',
        message_body: `Abandoned booking nudge sent to ${clientName}`,
        status: result.success ? 'sent' : 'failed',
        error: result.success ? null : result.error,
        inquiry_id: inquiryId ?? null,
        trigger_type: 'abandoned_booking',
      });
    } catch {
      // Non-blocking
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, messageSid: result.messageSid });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[/api/sms/abandoned-booking] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/sms/abandoned-booking
 * Returns leads who are candidates for an abandoned booking nudge:
 * - booking_stage = 'inquiry' (never booked)
 * - created_at between 1 and 48 hours ago
 * - has a phone number
 * - no abandoned booking SMS already sent
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const now = new Date();
    const cutoffOld = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
    const cutoffRecent = new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString();

    // Get leads in the abandoned window
    const { data: leads, error } = await supabase
      .from('contact_inquiries')
      .select('id, name, email, phone, service, created_at, booking_stage')
      .eq('booking_stage', 'inquiry')
      .not('phone', 'is', null)
      .gte('created_at', cutoffOld)
      .lte('created_at', cutoffRecent)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    // Filter out any that already received an abandoned booking SMS
    const leadIds = (leads ?? []).map((l: any) => l.id);
    let alreadySentIds: string[] = [];

    if (leadIds.length > 0) {
      const { data: sentLogs } = await supabase
        .from('sms_reminder_logs')
        .select('inquiry_id')
        .eq('message_type', 'abandoned_booking')
        .eq('status', 'sent')
        .in('inquiry_id', leadIds);

      alreadySentIds = (sentLogs ?? []).map((l: any) => l.inquiry_id).filter(Boolean);
    }

    const candidates = (leads ?? []).filter((l: any) => !alreadySentIds.includes(l.id));

    return NextResponse.json({ candidates, total: candidates.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
