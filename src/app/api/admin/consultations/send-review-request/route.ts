import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/admin/consultations/send-review-request
 * Trigger a Google review request email for a completed consultation.
 * Body: { inquiryId } — looks up client details from the inquiry
 */
export async function POST(req: NextRequest) {
  try {
    const { inquiryId } = await req.json();
    if (!inquiryId) {
      return NextResponse.json({ error: 'inquiryId is required.' }, { status: 400 });
    }

    const supabase = await createClient();

    // Fetch inquiry details
    const { data: inquiry, error: inquiryErr } = await supabase
      .from('contact_inquiries')
      .select('id, name, email, service')
      .eq('id', inquiryId)
      .single();

    if (inquiryErr || !inquiry) {
      return NextResponse.json({ error: 'Inquiry not found.' }, { status: 404 });
    }

    if (!inquiry.email) {
      return NextResponse.json({ error: 'No email address on file for this client.' }, { status: 400 });
    }

    // Call the review trigger endpoint
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://broussardlegalservices.com';
    const triggerRes = await fetch(`${siteUrl}/api/review/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inquiryId: inquiry.id,
        clientEmail: inquiry.email,
        clientName: inquiry.name,
        service: inquiry.service,
      }),
    });

    const triggerData = await triggerRes.json();

    if (!triggerRes.ok) {
      return NextResponse.json({ error: triggerData.error || 'Failed to send review request.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Review request sent to ${inquiry.email}`,
      ...triggerData,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
