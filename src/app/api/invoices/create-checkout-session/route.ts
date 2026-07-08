import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey || stripeSecretKey === 'your-stripe-secret-key-here') {
      return NextResponse.json({ error: 'Stripe is not configured. Please add your STRIPE_SECRET_KEY.' }, { status: 503 });
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' });

    const body = await req.json();
    const { invoice_id, amount, currency = 'usd', invoice_number, success_url, cancel_url } = body;

    if (!invoice_id || !amount || !invoice_number) {
      return NextResponse.json({ error: 'Missing required fields: invoice_id, amount, invoice_number' }, { status: 400 });
    }

    if (amount <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than zero' }, { status: 400 });
    }

    // Verify invoice exists and get client info
    const supabase = await createClient();
    const { data: invoice, error: invoiceError } = await supabase
      .from('client_invoices')
      .select('id, invoice_number, amount, amount_paid, status, inquiry_id')
      .eq('id', invoice_id)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.status === 'paid') {
      return NextResponse.json({ error: 'This invoice has already been paid' }, { status: 400 });
    }

    // Get client info from inquiry if available
    let clientEmail: string | undefined;
    let clientName: string | undefined;
    if (invoice.inquiry_id) {
      const { data: inquiry } = await supabase
        .from('contact_inquiries')
        .select('name, email')
        .eq('id', invoice.inquiry_id)
        .single();
      if (inquiry) {
        clientEmail = inquiry.email;
        clientName = inquiry.name;
      }
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: `Invoice ${invoice_number}`,
              description: `Payment for legal services — Invoice ${invoice_number}`,
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      customer_email: clientEmail,
      metadata: {
        invoice_id,
        invoice_number,
        client_name: clientName ?? '',
      },
      success_url: success_url ?? `${process.env.NEXT_PUBLIC_SITE_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}&invoice_id=${invoice_id}&invoice_number=${encodeURIComponent(invoice_number)}&amount=${amount}`,
      cancel_url: cancel_url ?? `${process.env.NEXT_PUBLIC_SITE_URL}/client/invoices`,
    });

    return NextResponse.json({ url: session.url, session_id: session.id });
  } catch (err: unknown) {
    console.error('[create-checkout-session] Error:', err);
    const message = err instanceof Error ? err.message : 'Failed to create checkout session';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
