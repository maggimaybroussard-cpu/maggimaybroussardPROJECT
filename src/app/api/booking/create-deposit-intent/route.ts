import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const PAYMENT_AMOUNTS: Record<string, number> = {
  consultation_deposit: 150,
  retainer: 1500,
};

const PAYMENT_LABELS: Record<string, string> = {
  consultation_deposit: 'Consultation Deposit',
  retainer: 'Monthly Retainer Agreement',
};

function generateInvoiceNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `INV-${year}${month}-${rand}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      paymentType,
      clientName,
      clientEmail,
      bookingId,
      inquiryId,
      userId,
      billingAddress,
    } = body as {
      paymentType: 'consultation_deposit' | 'retainer';
      clientName: string;
      clientEmail: string;
      bookingId?: string;
      inquiryId?: string;
      userId?: string;
      billingAddress?: {
        line1?: string;
        city?: string;
        state?: string;
        postal_code?: string;
        country?: string;
      };
    };

    if (!paymentType || !clientEmail || !clientName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const amountCents = (PAYMENT_AMOUNTS[paymentType] ?? 150) * 100;
    const label = PAYMENT_LABELS[paymentType] ?? 'Legal Services';

    // ── 1. Create or retrieve Stripe customer ─────────────────────────────────
    let stripeCustomerId: string | undefined;
    try {
      const existing = await stripe.customers.list({ email: clientEmail, limit: 1 });
      if (existing.data.length > 0) {
        stripeCustomerId = existing.data[0].id;
      } else {
        const customer = await stripe.customers.create({
          email: clientEmail,
          name: clientName,
          address: billingAddress
            ? {
                line1: billingAddress.line1 ?? '',
                city: billingAddress.city ?? '',
                state: billingAddress.state ?? '',
                postal_code: billingAddress.postal_code ?? '',
                country: billingAddress.country ?? 'US',
              }
            : undefined,
        });
        stripeCustomerId = customer.id;
      }
    } catch {
      // Non-fatal — proceed without customer
    }

    // ── 2. Create Stripe PaymentIntent ────────────────────────────────────────
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      customer: stripeCustomerId,
      receipt_email: clientEmail,
      description: `${label} — ${clientName}`,
      metadata: {
        payment_type: paymentType,
        customer_name: clientName,
        customer_email: clientEmail,
        booking_id: bookingId ?? '',
        inquiry_id: inquiryId ?? '',
        user_id: userId ?? '',
      },
    });

    // ── 3. Create client_invoices record ──────────────────────────────────────
    const supabase = await createClient();
    const invoiceNumber = generateInvoiceNumber();
    const today = new Date().toISOString().split('T')[0];

    const { data: invoice, error: invoiceError } = await supabase
      .from('client_invoices')
      .insert({
        invoice_number: invoiceNumber,
        invoice_date: today,
        due_date: today,
        amount: PAYMENT_AMOUNTS[paymentType],
        amount_paid: 0,
        currency: 'usd',
        status: 'pending',
        payment_type: paymentType,
        stripe_invoice_id: paymentIntent.id,
        stripe_customer_id: stripeCustomerId ?? null,
        user_id: userId ?? null,
        inquiry_id: inquiryId ?? null,
        booking_id: bookingId ?? null,
        line_items: JSON.stringify([
          {
            description: label,
            quantity: 1,
            unitPrice: PAYMENT_AMOUNTS[paymentType],
            total: PAYMENT_AMOUNTS[paymentType],
          },
        ]),
        notes:
          paymentType === 'consultation_deposit' ?'Consultation deposit — applied toward first invoice upon engagement.' :'Monthly retainer for ongoing legal support and document drafting.',
      })
      .select('id, invoice_number')
      .single();

    if (invoiceError) {
      console.error('[booking-deposit] Invoice insert error:', invoiceError);
      // Non-fatal — PI was created, webhook will handle receipt
    }

    // Update PI metadata with invoice_id for webhook lookup
    if (invoice?.id) {
      await stripe.paymentIntents.update(paymentIntent.id, {
        metadata: {
          ...paymentIntent.metadata,
          invoice_id: invoice.id,
        },
      });
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      invoiceId: invoice?.id ?? null,
      invoiceNumber: invoice?.invoice_number ?? invoiceNumber,
    });
  } catch (err) {
    console.error('[booking-deposit] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create payment intent' },
      { status: 500 }
    );
  }
}
