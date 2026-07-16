import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { inquiryId, newStatus, notifyClient = true } = body;

    if (!inquiryId || !newStatus) {
      return NextResponse.json({ error: 'Missing inquiryId or newStatus' }, { status: 400 });
    }

    const supabase = await createClient();

    // 1. Fetch current inquiry details
    const { data: inquiry, error: fetchError } = await supabase
      .from('contact_inquiries')
      .select('id, name, email, service, status')
      .eq('id', inquiryId)
      .single();

    if (fetchError || !inquiry) {
      return NextResponse.json({ error: 'Inquiry not found' }, { status: 404 });
    }

    const previousStatus = inquiry.status;

    // 2. Update the status in DB
    const { error: updateError } = await supabase
      .from('contact_inquiries')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', inquiryId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // 3. Send automated email notification if status actually changed and client wants notification
    let emailSent = false;
    if (notifyClient && previousStatus !== newStatus && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const notifyRes = await fetch(`${SUPABASE_URL}/functions/v1/notify-client`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            clientEmail: inquiry.email,
            clientName: inquiry.name,
            eventType: 'status_change',
            inquiryId,
            details: {
              newStatus,
              previousStatus,
              service: inquiry.service,
            },
          }),
        });
        emailSent = notifyRes.ok;
      } catch (emailErr) {
        console.error('Status change notification email error (non-fatal):', emailErr);
      }
    }

    return NextResponse.json({
      success: true,
      inquiryId,
      previousStatus,
      newStatus,
      emailSent,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update inquiry status' },
      { status: 500 }
    );
  }
}
