import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      recipientEmail,
      recipientName,
      service,
      amount,
      paymentType,
      referenceCode,
      paymentIntentId,
      inquiryId,
      consultationDate,
    } = body;

    if (!recipientEmail) {
      return NextResponse.json({ error: 'recipientEmail is required' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const res = await fetch(`${supabaseUrl}/functions/v1/schedule-post-payment-sequence`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        inquiryId: inquiryId ?? null,
        recipientEmail,
        recipientName: recipientName ?? 'Valued Client',
        service: service ?? 'Legal Services',
        amount: amount ?? 0,
        paymentType: paymentType ?? 'consultation_deposit',
        referenceCode: referenceCode ?? paymentIntentId ?? 'N/A',
        paymentIntentId: paymentIntentId ?? null,
        paymentDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        consultationDate: consultationDate ?? null,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error ?? 'Failed to schedule post-payment sequence');
    }

    return NextResponse.json({ success: true, ...data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to trigger post-payment sequence';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
