import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const invoiceId = searchParams.get('invoice_id');

    if (!invoiceId) {
      return NextResponse.json({ error: 'Missing invoice_id' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: invoice, error } = await supabase
      .from('client_invoices')
      .select('id, invoice_number, amount, amount_paid, currency, status, due_date, invoice_date, notes, line_items, created_at, inquiry_id')
      .eq('id', invoiceId)
      .single();

    if (error || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    return NextResponse.json({ invoice });
  } catch (err: unknown) {
    console.error('[get-invoice-details] Error:', err);
    const message = err instanceof Error ? err.message : 'Failed to fetch invoice';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
