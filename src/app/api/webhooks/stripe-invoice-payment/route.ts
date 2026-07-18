import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_INVOICE_WEBHOOK_SECRET ?? '';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature') ?? '';

  let event: Stripe.Event;

  try {
    if (webhookSecret && signature) {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } else {
      event = JSON.parse(body) as Stripe.Event;
    }
  } catch (err) {
    console.error('[stripe-invoice-payment-webhook] signature error:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = await createClient();

  try {
    switch (event.type) {
      // ── Checkout session completed (client paid invoice via portal) ────────
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        const invoiceId = session.metadata?.invoice_id;
        const invoiceNumber = session.metadata?.invoice_number;

        if (!invoiceId) {
          console.log('[stripe-invoice-payment-webhook] No invoice_id in metadata, skipping.');
          break;
        }

        if (session.payment_status !== 'paid') {
          console.log(`[stripe-invoice-payment-webhook] Session ${session.id} not paid yet, skipping.`);
          break;
        }

        const amountPaid = (session.amount_total ?? 0) / 100;
        const customerEmail = session.customer_email ?? session.metadata?.customer_email ?? '';
        const customerName = session.metadata?.customer_name ?? '';

        const { data: invoice, error: fetchError } = await supabase
          .from('client_invoices')
          .select('id, invoice_number, amount, amount_paid, status, inquiry_id, user_id, currency')
          .eq('id', invoiceId)
          .maybeSingle();

        if (fetchError || !invoice) {
          console.error('[stripe-invoice-payment-webhook] Invoice not found:', invoiceId, fetchError);
          break;
        }

        if (invoice.status === 'paid') {
          console.log(`[stripe-invoice-payment-webhook] Invoice ${invoiceId} already paid, skipping.`);
          break;
        }

        const newAmountPaid = Math.min(
          Number(invoice.amount_paid) + amountPaid,
          Number(invoice.amount)
        );
        const isPaidInFull = newAmountPaid >= Number(invoice.amount);

        const { error: updateError } = await supabase
          .from('client_invoices')
          .update({
            status: isPaidInFull ? 'paid' : 'pending',
            amount_paid: newAmountPaid,
            stripe_invoice_id: session.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', invoiceId);

        if (updateError) {
          console.error('[stripe-invoice-payment-webhook] Failed to update invoice:', updateError);
          break;
        }

        const paymentIntentId =
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id ?? session.id;

        const { data: existingPayment } = await supabase
          .from('payments')
          .select('id')
          .eq('payment_intent_id', paymentIntentId)
          .maybeSingle();

        if (!existingPayment) {
          await supabase.from('payments').insert({
            user_id: invoice.user_id ?? null,
            payment_intent_id: paymentIntentId,
            amount: amountPaid,
            currency: invoice.currency || 'usd',
            payment_status: 'succeeded',
            payment_type: 'invoice_payment',
            description: `Invoice ${invoiceNumber || invoice.invoice_number} payment`,
            customer_name: customerName,
            customer_email: customerEmail,
            created_at: new Date().toISOString(),
          });
        }

        console.log(
          `[stripe-invoice-payment-webhook] Invoice ${invoiceId} marked ${isPaidInFull ? 'paid' : 'partial'} — $${amountPaid} — session: ${session.id}`
        );
        break;
      }

      // ── Stripe Invoice paid (via Stripe Invoice API / billing portal) ──────
      case 'invoice.paid': {
        const stripeInvoice = event.data.object as Stripe.Invoice;
        const invoiceId = stripeInvoice.metadata?.invoice_id;

        if (!invoiceId) {
          console.log('[stripe-invoice-payment-webhook] invoice.paid: no invoice_id in metadata, skipping.');
          break;
        }

        const amountPaid = (stripeInvoice.amount_paid ?? 0) / 100;
        const customerEmail =
          typeof stripeInvoice.customer_email === 'string' ? stripeInvoice.customer_email : '';
        const customerName =
          typeof stripeInvoice.customer_name === 'string' ? stripeInvoice.customer_name : '';

        const { data: invoice, error: fetchErr } = await supabase
          .from('client_invoices')
          .select('id, invoice_number, amount, amount_paid, status, inquiry_id, user_id, currency')
          .eq('id', invoiceId)
          .maybeSingle();

        if (fetchErr || !invoice) {
          console.error('[stripe-invoice-payment-webhook] invoice.paid: invoice not found:', invoiceId);
          break;
        }

        if (invoice.status === 'paid') {
          console.log(`[stripe-invoice-payment-webhook] invoice.paid: Invoice ${invoiceId} already paid, skipping.`);
          break;
        }

        // Update invoice as paid and store Stripe invoice URL for client portal
        const { error: updateErr } = await supabase
          .from('client_invoices')
          .update({
            status: 'paid',
            amount_paid: Number(invoice.amount),
            stripe_invoice_id: stripeInvoice.id,
            stripe_invoice_url: stripeInvoice.hosted_invoice_url,
            stripe_invoice_pdf: stripeInvoice.invoice_pdf,
            stripe_sync_status: 'synced',
            updated_at: new Date().toISOString(),
          })
          .eq('id', invoiceId);

        if (updateErr) {
          console.error('[stripe-invoice-payment-webhook] invoice.paid: DB update failed:', updateErr);
          break;
        }

        // Record payment in payments table for history
        const paymentIntentId =
          typeof stripeInvoice.payment_intent === 'string'
            ? stripeInvoice.payment_intent
            : (stripeInvoice.payment_intent as Stripe.PaymentIntent)?.id ?? stripeInvoice.id;

        const { data: existingPayment } = await supabase
          .from('payments')
          .select('id')
          .eq('payment_intent_id', paymentIntentId)
          .maybeSingle();

        if (!existingPayment) {
          await supabase.from('payments').insert({
            user_id: invoice.user_id ?? null,
            payment_intent_id: paymentIntentId,
            amount: amountPaid,
            currency: invoice.currency || 'usd',
            payment_status: 'succeeded',
            payment_type: 'invoice_payment',
            description: `Invoice ${invoice.invoice_number} — paid via Stripe`,
            customer_name: customerName,
            customer_email: customerEmail,
            created_at: new Date().toISOString(),
          });
        }

        console.log(`[stripe-invoice-payment-webhook] invoice.paid: Invoice ${invoiceId} marked paid — Stripe ${stripeInvoice.id}`);
        break;
      }

      // ── Stripe Invoice payment failed ─────────────────────────────────────
      case 'invoice.payment_failed': {
        const stripeInvoice = event.data.object as Stripe.Invoice;
        const invoiceId = stripeInvoice.metadata?.invoice_id;

        if (!invoiceId) break;

        // Keep invoice as pending/overdue but update the Stripe URL so client can retry
        await supabase
          .from('client_invoices')
          .update({
            stripe_invoice_id: stripeInvoice.id,
            stripe_invoice_url: stripeInvoice.hosted_invoice_url,
            stripe_invoice_pdf: stripeInvoice.invoice_pdf,
            updated_at: new Date().toISOString(),
          })
          .eq('id', invoiceId);

        console.log(`[stripe-invoice-payment-webhook] invoice.payment_failed: Invoice ${invoiceId} — Stripe ${stripeInvoice.id}`);
        break;
      }

      // ── Stripe Invoice updated (e.g. URL refreshed) ───────────────────────
      case 'invoice.updated': {
        const stripeInvoice = event.data.object as Stripe.Invoice;
        const invoiceId = stripeInvoice.metadata?.invoice_id;

        if (!invoiceId) break;

        // Refresh the hosted URL in case it changed
        if (stripeInvoice.hosted_invoice_url) {
          await supabase
            .from('client_invoices')
            .update({
              stripe_invoice_url: stripeInvoice.hosted_invoice_url,
              stripe_invoice_pdf: stripeInvoice.invoice_pdf,
              updated_at: new Date().toISOString(),
            })
            .eq('id', invoiceId);
        }
        break;
      }

      // ── Checkout session expired ──────────────────────────────────────────
      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;
        const invoiceId = session.metadata?.invoice_id;
        if (!invoiceId) break;
        console.log(`[stripe-invoice-payment-webhook] Checkout expired for invoice ${invoiceId}`);
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true, event: event.type });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Webhook processing failed';
    console.error('[stripe-invoice-payment-webhook] error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
