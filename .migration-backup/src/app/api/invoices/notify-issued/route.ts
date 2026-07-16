import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      clientEmail,
      clientName,
      invoiceNumber,
      invoiceDate,
      dueDate,
      amount,
      currency = 'usd',
      inquiryId,
      lineItems,
      notes,
      paymentLink,
    } = body;

    if (!clientEmail || !clientName || !invoiceNumber || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }, { status: 503 });
    }

    // Fire notify-client with invoice_issued event
    const notifyRes = await fetch(`${SUPABASE_URL}/functions/v1/notify-client`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        clientEmail,
        clientName,
        eventType: 'invoice_issued',
        inquiryId: inquiryId ?? null,
        details: {
          invoiceNumber,
          invoiceDate,
          dueDate,
          amount,
          currency,
          lineItems: lineItems ?? [],
          notes: notes ?? '',
          paymentLink: paymentLink ?? null,
        },
      }),
    });

    if (!notifyRes.ok) {
      const errBody = await notifyRes.json().catch(() => ({}));
      throw new Error(errBody?.error ?? `notify-client returned ${notifyRes.status}`);
    }

    const data = await notifyRes.json();
    return NextResponse.json({ success: true, emailId: data.id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to send invoice notification' },
      { status: 500 }
    );
  }
}
