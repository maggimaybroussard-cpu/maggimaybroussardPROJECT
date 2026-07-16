import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

/**
 * POST /api/invoices/create-checkout-session
 *
 * Creates a Stripe Checkout session pre-filled with invoice details.
 * Stores the session ID on the invoice row for webhook deduplication.
 * Returns { url, sessionId } — caller redirects to `url`.
 */
export async function POST(req: NextRequest) {
  try {
    const {
      invoiceId,
      invoiceNumber,
      description,
      amount,
      currency,
      customerEmail,
      customerName,
      dueDate,
      successPath = '/portal/billing',
      cancelPath = '/portal/billing',
    } = await req.json();

    if (!amount || !invoiceNumber) {
      return NextResponse.json({ error: 'Missing required fields: amount, invoiceNumber' }, { status: 400 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://broussardlegalservices.com';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: customerEmail || undefined,
      submit_type: 'pay',
      billing_address_collection: 'auto',
      line_items: [
        {
          price_data: {
            currency: (currency || 'usd').toLowerCase(),
            product_data: {
              name: description || `Invoice ${invoiceNumber}`,
              description: `Invoice ${invoiceNumber}${dueDate ? ` · Due ${new Date(dueDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}` : ''}`,
              metadata: {
                invoice_number: invoiceNumber,
                customer_name: customerName || '',
              },
            },
            unit_amount: Math.round(Number(amount) * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        invoice_id: invoiceId || '',
        invoice_number: invoiceNumber,
        customer_name: customerName || '',
        customer_email: customerEmail || '',
      },
      success_url: `${siteUrl}${successPath}?payment=success&invoice=${invoiceNumber}`,
      cancel_url: `${siteUrl}${cancelPath}?payment=cancelled`,
    });

    // Store the checkout session ID on the invoice for webhook deduplication
    if (invoiceId && session.id) {
      try {
        const { createClient } = await import('@/lib/supabase/server');
        const supabase = await createClient();
        await supabase
          .from('client_invoices')
          .update({ stripe_checkout_session_id: session.id })
          .eq('id', invoiceId);
      } catch (dbErr) {
        // Non-fatal — webhook will still mark invoice paid on completion
        console.warn('[create-checkout-session] Could not store checkout session ID:', dbErr);
      }
    }

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (err: unknown) {
    console.error('[create-checkout-session] error:', err);
    const message = err instanceof Error ? err.message : 'Failed to create checkout session';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
