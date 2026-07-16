import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      clientEmail,
      clientName,
      invoiceNumber,
      issueDate,
      dueDate,
      firmName,
      firmEmail,
      firmPhone,
      matterRef,
      lineItems,
      subtotal,
      taxRate,
      taxAmount,
      totalDue,
      notes,
    } = body;

    if (!clientEmail || !clientName || !invoiceNumber) {
      return NextResponse.json({ error: 'Missing required fields: clientEmail, clientName, invoiceNumber' }, { status: 400 });
    }

    if (!SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 503 });
    }

    // Call the edge function
    const edgeRes = await fetch(`${SUPABASE_URL}/functions/v1/send-invoice-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        clientEmail,
        clientName,
        invoiceNumber,
        issueDate,
        dueDate,
        firmName,
        firmEmail,
        firmPhone,
        matterRef,
        lineItems: lineItems ?? [],
        subtotal: subtotal ?? 0,
        taxRate: taxRate ?? 0,
        taxAmount: taxAmount ?? 0,
        totalDue: totalDue ?? 0,
        notes: notes ?? '',
      }),
    });

    if (!edgeRes.ok) {
      const errBody = await edgeRes.json().catch(() => ({}));
      throw new Error(errBody?.error ?? `Edge function returned ${edgeRes.status}`);
    }

    const data = await edgeRes.json();

    // Log the send event to Supabase
    try {
      const supabase = await createClient();
      await supabase.from('invoice_email_logs').insert({
        invoice_number: invoiceNumber,
        client_email: clientEmail,
        client_name: clientName,
        email_id: data.emailId ?? null,
        sent_at: new Date().toISOString(),
        status: 'sent',
      });
    } catch {
      // Non-fatal: log failure doesn't block the response
    }

    return NextResponse.json({ success: true, emailId: data.emailId });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to send invoice email' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const invoiceNumber = searchParams.get('invoiceNumber');

    if (!invoiceNumber) {
      return NextResponse.json({ logs: [] });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('invoice_email_logs')
      .select('*')
      .eq('invoice_number', invoiceNumber)
      .order('sent_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ logs: data ?? [] });
  } catch (err) {
    return NextResponse.json({ logs: [], error: err instanceof Error ? err.message : 'Failed to fetch logs' });
  }
}
