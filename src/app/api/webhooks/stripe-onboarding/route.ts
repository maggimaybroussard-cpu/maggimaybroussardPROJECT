import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_ONBOARDING_WEBHOOK_SECRET ?? '';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature') ?? '';

  let event: Stripe.Event;

  try {
    if (webhookSecret && signature) {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } else {
      // Dev fallback — parse raw body (no signature verification)
      event = JSON.parse(body) as Stripe.Event;
    }
  } catch (err) {
    console.error('[stripe-onboarding-webhook] signature error:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = await createClient();

  try {
    switch (event.type) {
      // ── Retainer fee collected ─────────────────────────────────────────────
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;

        // Only process onboarding retainer payments
        if (pi.metadata?.payment_type !== 'onboarding_retainer') break;

        const userId = pi.metadata?.user_id ?? null;
        const customerEmail = pi.metadata?.customer_email ?? '';
        const planName = pi.metadata?.plan_name ?? 'Initial Retainer Fee';
        const amountPaid = pi.amount / 100;

        // 1. Update payment record status
        await supabase
          .from('payments')
          .update({
            payment_status: 'succeeded',
            stripe_charge_id: typeof pi.latest_charge === 'string' ? pi.latest_charge : null,
            updated_at: new Date().toISOString(),
          })
          .eq('payment_intent_id', pi.id);

        // 2. Sync a client_invoices record
        const invoiceNumber = `RET-ONB-${pi.id.slice(-10).toUpperCase()}`;
        const today = new Date().toISOString().split('T')[0];

        const lineItems = [
          {
            description: `${planName} – Onboarding Retainer`,
            quantity: 1,
            unitPrice: amountPaid,
            total: amountPaid,
          },
          {
            description: 'Initial retainer fee collected at client onboarding',
            quantity: 1,
            unitPrice: 0,
            total: 0,
          },
        ];

        // Resolve inquiry_id from portal access if available
        let inquiryId: string | null = null;
        if (userId) {
          const { data: access } = await supabase
            .from('client_portal_access')
            .select('inquiry_id')
            .eq('user_id', userId)
            .maybeSingle();
          inquiryId = access?.inquiry_id ?? null;
        }

        await supabase.from('client_invoices').upsert(
          {
            user_id: userId,
            inquiry_id: inquiryId,
            invoice_number: invoiceNumber,
            invoice_date: today,
            due_date: today,
            amount: amountPaid,
            amount_paid: amountPaid,
            currency: 'usd',
            status: 'paid',
            line_items: lineItems,
            notes: `Onboarding retainer fee. Stripe PaymentIntent: ${pi.id}. Customer: ${customerEmail}.`,
            stripe_invoice_id: pi.id,
          },
          { onConflict: 'invoice_number' }
        );

        // 3. Mark payment_linked = true on onboarding record
        if (userId) {
          await supabase
            .from('client_onboarding')
            .update({ payment_linked: true })
            .eq('user_id', userId);
        }

        // 4. Trigger invoice email via generate-invoice edge function (non-fatal)
        try {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
          const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

          // Fetch customer name from payments table
          const { data: paymentRecord } = await supabase
            .from('payments')
            .select('customer_name')
            .eq('payment_intent_id', pi.id)
            .maybeSingle();

          await fetch(`${supabaseUrl}/functions/v1/generate-invoice`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({
              clientEmail: customerEmail,
              clientName: paymentRecord?.customer_name ?? customerEmail,
              paymentIntentId: pi.id,
              paymentType: 'onboarding_retainer',
              amount: amountPaid,
              currency: 'usd',
              description: `${planName} – Onboarding Retainer`,
              items: lineItems,
              invoiceNumber,
              createdAt: new Date().toISOString(),
            }),
          });
        } catch (invoiceErr) {
          console.error('[stripe-onboarding-webhook] generate-invoice error (non-fatal):', invoiceErr);
        }

        console.log(`[stripe-onboarding-webhook] Retainer collected: ${pi.id} — $${amountPaid} — user: ${userId}`);
        break;
      }

      // ── Payment failed ─────────────────────────────────────────────────────
      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        if (pi.metadata?.payment_type !== 'onboarding_retainer') break;

        await supabase
          .from('payments')
          .update({
            payment_status: 'failed',
            updated_at: new Date().toISOString(),
          })
          .eq('payment_intent_id', pi.id);

        console.warn(`[stripe-onboarding-webhook] Payment failed: ${pi.id}`);
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true, event: event.type });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Webhook processing failed';
    console.error('[stripe-onboarding-webhook] error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
