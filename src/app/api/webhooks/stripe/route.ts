/**
 * Unified Stripe Webhook Handler
 *
 * Endpoint: POST /api/webhooks/stripe
 * Secret:   STRIPE_WEBHOOK_SECRET
 *
 * Handles all payment events in one place:
 *  - payment_intent.succeeded          → mark invoice paid, unlock portal, send receipt + post-payment sequence
 *  - payment_intent.payment_failed     → update invoice status, notify admin
 *  - invoice.paid                      → sync Stripe invoice, unlock portal access
 *  - invoice.payment_failed            → flag invoice, notify admin
 *  - checkout.session.completed        → mark invoice paid, trigger post-payment sequence
 *  - customer.subscription.created     → activate retainer, unlock portal access
 *  - customer.subscription.updated     → sync subscription status
 *  - customer.subscription.deleted     → cancel retainer, revoke portal access
 *  - charge.refunded                   → mark invoice refunded, notify admin
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? '';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const RESEND_API_KEY = process.env.RESEND_API_KEY ?? '';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'maggimaybroussard@gmail.com';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://broussardlegalservices.com';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function sendAdminEmail(subject: string, html: string): Promise<void> {
  if (!RESEND_API_KEY) return;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'maggimay@broussardlegalservices.com',
        to: [ADMIN_EMAIL],
        subject,
        html,
      }),
    });
  } catch (err) {
    console.error('[stripe-webhook] admin email error:', err);
  }
}

async function triggerPostPaymentSequence(params: {
  recipientEmail: string;
  recipientName: string;
  service: string;
  amount: number;
  paymentType: string;
  paymentIntentId: string;
  inquiryId?: string | null;
}): Promise<void> {
  try {
    await fetch(`${SITE_URL}/api/post-payment-sequence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipientEmail: params.recipientEmail,
        recipientName: params.recipientName,
        service: params.service,
        amount: params.amount,
        paymentType: params.paymentType,
        paymentIntentId: params.paymentIntentId,
        inquiryId: params.inquiryId ?? null,
      }),
    });
  } catch (err) {
    console.error('[stripe-webhook] post-payment sequence error:', err);
  }
}

async function unlockPortalAccess(params: {
  userId?: string | null;
  inquiryId?: string | null;
  customerEmail?: string;
  accessLevel?: string;
}): Promise<void> {
  const supabase = await createClient();
  try {
    if (params.userId) {
      // Update existing portal access record
      const { error } = await supabase
        .from('client_portal_access')
        .update({
          portal_access: true,
          access_level: params.accessLevel ?? 'full',
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', params.userId);

      if (error) {
        console.error('[stripe-webhook] portal access update error (user_id):', error.message);
      } else {
        console.log('[stripe-webhook] Portal access unlocked for user:', params.userId);
      }
    } else if (params.inquiryId) {
      // Update by inquiry_id
      const { error } = await supabase
        .from('client_portal_access')
        .update({
          portal_access: true,
          access_level: params.accessLevel ?? 'full',
          updated_at: new Date().toISOString(),
        })
        .eq('inquiry_id', params.inquiryId);

      if (error) {
        console.error('[stripe-webhook] portal access update error (inquiry_id):', error.message);
      } else {
        console.log('[stripe-webhook] Portal access unlocked for inquiry:', params.inquiryId);
      }
    } else if (params.customerEmail) {
      // Fallback: look up portal access by email via user_profiles
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('user_id')
        .eq('email', params.customerEmail)
        .maybeSingle();

      if (profile?.user_id) {
        await supabase
          .from('client_portal_access')
          .update({
            portal_access: true,
            access_level: params.accessLevel ?? 'full',
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', profile.user_id);
        console.log('[stripe-webhook] Portal access unlocked via email lookup:', params.customerEmail);
      }
    }
  } catch (err) {
    console.error('[stripe-webhook] unlockPortalAccess error:', err);
  }
}

async function resolveClientFromInvoice(
  supabase: Awaited<ReturnType<typeof createClient>>,
  invoiceId: string
): Promise<{ email: string; name: string; userId: string | null; inquiryId: string | null }> {
  const { data: inv } = await supabase
    .from('client_invoices')
    .select('user_id, inquiry_id')
    .eq('id', invoiceId)
    .maybeSingle();

  let email = '';
  let name = '';
  const userId = inv?.user_id ?? null;
  const inquiryId = inv?.inquiry_id ?? null;

  if (userId) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('email, full_name')
      .eq('user_id', userId)
      .maybeSingle();
    email = profile?.email ?? '';
    name = profile?.full_name ?? '';
  }

  if ((!email || !name) && inquiryId) {
    const { data: inquiry } = await supabase
      .from('contact_inquiries')
      .select('email, name')
      .eq('id', inquiryId)
      .maybeSingle();
    email = email || inquiry?.email || '';
    name = name || inquiry?.name || '';
  }

  return { email, name, userId, inquiryId };
}

// ─── Main Webhook Handler ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature') ?? '';

  let event: Stripe.Event;

  try {
    if (webhookSecret && signature) {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } else {
      // Dev fallback — no signature verification
      event = JSON.parse(body) as Stripe.Event;
    }
  } catch (err) {
    console.error('[stripe-webhook] signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  console.log(`[stripe-webhook] Processing event: ${event.type} [${event.id}]`);

  const supabase = await createClient();

  try {
    switch (event.type) {

      // ── payment_intent.succeeded ──────────────────────────────────────────
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const amountPaid = pi.amount / 100;
        const currency = pi.currency ?? 'usd';
        const customerEmail = pi.metadata?.customer_email ?? pi.receipt_email ?? '';
        const customerName = pi.metadata?.customer_name ?? '';
        const invoiceId = pi.metadata?.invoice_id ?? null;
        const userId = pi.metadata?.user_id ?? null;
        const paymentType = pi.metadata?.payment_type ?? 'payment';

        // Skip types handled by dedicated webhooks to avoid double-processing
        if (
          paymentType === 'onboarding_retainer' ||
          paymentType === 'consultation_deposit' ||
          paymentType === 'retainer'
        ) {
          console.log(`[stripe-webhook] Skipping ${paymentType} PI — handled by dedicated webhook`);
          break;
        }

        // Update invoice if linked
        if (invoiceId) {
          const { data: inv } = await supabase
            .from('client_invoices')
            .select('id, invoice_number, amount, amount_paid, status, inquiry_id, user_id')
            .eq('id', invoiceId)
            .maybeSingle();

          if (inv && inv.status !== 'paid') {
            const newAmountPaid = Math.min(Number(inv.amount_paid) + amountPaid, Number(inv.amount));
            const isPaidInFull = newAmountPaid >= Number(inv.amount);

            await supabase
              .from('client_invoices')
              .update({
                status: isPaidInFull ? 'paid' : 'pending',
                amount_paid: newAmountPaid,
                stripe_invoice_id: pi.id,
                updated_at: new Date().toISOString(),
              })
              .eq('id', invoiceId);

            // Unlock portal access on full payment
            if (isPaidInFull) {
              await unlockPortalAccess({
                userId: userId || inv.user_id,
                inquiryId: inv.inquiry_id,
                customerEmail,
              });

              // Trigger post-payment email sequence
              const client = await resolveClientFromInvoice(supabase, invoiceId);
              await triggerPostPaymentSequence({
                recipientEmail: client.email || customerEmail,
                recipientName: client.name || customerName || 'Valued Client',
                service: pi.description ?? 'Legal Services',
                amount: amountPaid,
                paymentType,
                paymentIntentId: pi.id,
                inquiryId: client.inquiryId,
              });
            }

            console.log(`[stripe-webhook] payment_intent.succeeded: Invoice ${invoiceId} → ${isPaidInFull ? 'paid' : 'partial'}`);
          }
        }

        // Log to paid_receipt_logs
        await supabase.from('paid_receipt_logs').upsert(
          {
            payment_intent_id: pi.id,
            amount: amountPaid,
            currency,
            customer_email: customerEmail || null,
            customer_name: customerName || null,
            invoice_id: invoiceId,
            status: 'paid_in_full',
            raw_metadata: pi.metadata ?? {},
            created_at: new Date().toISOString(),
          },
          { onConflict: 'payment_intent_id' }
        );

        break;
      }

      // ── payment_intent.payment_failed ─────────────────────────────────────
      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const invoiceId = pi.metadata?.invoice_id ?? null;
        const customerEmail = pi.metadata?.customer_email ?? '';
        const customerName = pi.metadata?.customer_name ?? '';
        const failureMessage = pi.last_payment_error?.message ?? 'Payment declined';

        if (invoiceId) {
          await supabase
            .from('client_invoices')
            .update({
              stripe_invoice_id: pi.id,
              updated_at: new Date().toISOString(),
            })
            .eq('id', invoiceId);
        }

        // Notify admin of failed payment
        await sendAdminEmail(
          `⚠️ Payment Failed — ${customerName || customerEmail}`,
          `<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:24px;background:#FAF7F2;border-radius:10px;border:1px solid #D9D0C5;">
            <h2 style="color:#c0392b;margin:0 0 16px;">⚠️ Payment Failed</h2>
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <tr><td style="padding:8px 0;color:#7A6B5D;width:40%;border-bottom:1px solid #EDE8E0;">Client</td><td style="padding:8px 0;color:#2C1F14;border-bottom:1px solid #EDE8E0;">${customerName || '—'} &lt;${customerEmail || '—'}&gt;</td></tr>
              <tr><td style="padding:8px 0;color:#7A6B5D;border-bottom:1px solid #EDE8E0;">Amount</td><td style="padding:8px 0;color:#2C1F14;border-bottom:1px solid #EDE8E0;">$${(pi.amount / 100).toFixed(2)}</td></tr>
              <tr><td style="padding:8px 0;color:#7A6B5D;border-bottom:1px solid #EDE8E0;">Reason</td><td style="padding:8px 0;color:#c0392b;border-bottom:1px solid #EDE8E0;">${failureMessage}</td></tr>
              <tr><td style="padding:8px 0;color:#7A6B5D;">Payment Intent</td><td style="padding:8px 0;font-size:12px;font-family:monospace;color:#7A6B5D;">${pi.id}</td></tr>
            </table>
            <p style="margin:20px 0 0;font-size:13px;color:#7A6B5D;"><a href="${SITE_URL}/admin" style="color:#C8965A;">View in admin dashboard</a></p>
          </div>`
        );

        console.warn(`[stripe-webhook] payment_intent.payment_failed: ${pi.id} — ${failureMessage}`);
        break;
      }

      // ── invoice.paid (Stripe Billing / subscriptions) ─────────────────────
      case 'invoice.paid': {
        const stripeInv = event.data.object as Stripe.Invoice;
        const invoiceId = stripeInv.metadata?.invoice_id ?? null;
        const customerEmail =
          typeof stripeInv.customer_email === 'string' ? stripeInv.customer_email : '';
        const customerName =
          typeof stripeInv.customer_name === 'string' ? stripeInv.customer_name : '';
        const amountPaid = (stripeInv.amount_paid ?? 0) / 100;

        if (invoiceId) {
          const { data: inv } = await supabase
            .from('client_invoices')
            .select('id, status, user_id, inquiry_id, amount')
            .eq('id', invoiceId)
            .maybeSingle();

          if (inv && inv.status !== 'paid') {
            await supabase
              .from('client_invoices')
              .update({
                status: 'paid',
                amount_paid: Number(inv.amount),
                stripe_invoice_id: stripeInv.id,
                stripe_invoice_url: stripeInv.hosted_invoice_url,
                stripe_invoice_pdf: stripeInv.invoice_pdf,
                stripe_sync_status: 'synced',
                updated_at: new Date().toISOString(),
              })
              .eq('id', invoiceId);

            // Unlock portal access
            await unlockPortalAccess({
              userId: inv.user_id,
              inquiryId: inv.inquiry_id,
              customerEmail,
            });

            // Trigger post-payment sequence
            const paymentIntentId =
              typeof stripeInv.payment_intent === 'string'
                ? stripeInv.payment_intent
                : (stripeInv.payment_intent as Stripe.PaymentIntent)?.id ?? stripeInv.id;

            await triggerPostPaymentSequence({
              recipientEmail: customerEmail,
              recipientName: customerName || 'Valued Client',
              service: 'Legal Services',
              amount: amountPaid,
              paymentType: 'invoice_payment',
              paymentIntentId,
              inquiryId: inv.inquiry_id,
            });

            console.log(`[stripe-webhook] invoice.paid: Invoice ${invoiceId} marked paid`);
          }
        }
        break;
      }

      // ── invoice.payment_failed ────────────────────────────────────────────
      case 'invoice.payment_failed': {
        const stripeInv = event.data.object as Stripe.Invoice;
        const invoiceId = stripeInv.metadata?.invoice_id ?? null;
        const customerEmail =
          typeof stripeInv.customer_email === 'string' ? stripeInv.customer_email : '';
        const customerName =
          typeof stripeInv.customer_name === 'string' ? stripeInv.customer_name : '';

        if (invoiceId) {
          await supabase
            .from('client_invoices')
            .update({
              stripe_invoice_id: stripeInv.id,
              stripe_invoice_url: stripeInv.hosted_invoice_url,
              updated_at: new Date().toISOString(),
            })
            .eq('id', invoiceId);
        }

        await sendAdminEmail(
          `⚠️ Invoice Payment Failed — ${customerName || customerEmail}`,
          `<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:24px;background:#FAF7F2;border-radius:10px;border:1px solid #D9D0C5;">
            <h2 style="color:#c0392b;margin:0 0 16px;">⚠️ Invoice Payment Failed</h2>
            <p style="color:#2C1F14;">Client: <strong>${customerName || customerEmail || '—'}</strong></p>
            <p style="color:#2C1F14;">Stripe Invoice: <code style="font-size:12px;">${stripeInv.id}</code></p>
            <p style="color:#2C1F14;">Hosted URL: <a href="${stripeInv.hosted_invoice_url ?? '#'}" style="color:#C8965A;">View Invoice</a></p>
            <p style="margin-top:16px;font-size:13px;color:#7A6B5D;"><a href="${SITE_URL}/admin" style="color:#C8965A;">View in admin dashboard</a></p>
          </div>`
        );

        console.warn(`[stripe-webhook] invoice.payment_failed: ${stripeInv.id}`);
        break;
      }

      // ── checkout.session.completed ────────────────────────────────────────
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const invoiceId = session.metadata?.invoice_id ?? null;
        const customerEmail = session.customer_email ?? session.metadata?.customer_email ?? '';
        const customerName = session.metadata?.customer_name ?? '';

        if (!invoiceId || session.payment_status !== 'paid') break;

        const amountPaid = (session.amount_total ?? 0) / 100;

        const { data: inv } = await supabase
          .from('client_invoices')
          .select('id, invoice_number, amount, amount_paid, status, user_id, inquiry_id, currency')
          .eq('id', invoiceId)
          .maybeSingle();

        if (!inv || inv.status === 'paid') break;

        const newAmountPaid = Math.min(Number(inv.amount_paid) + amountPaid, Number(inv.amount));
        const isPaidInFull = newAmountPaid >= Number(inv.amount);

        await supabase
          .from('client_invoices')
          .update({
            status: isPaidInFull ? 'paid' : 'pending',
            amount_paid: newAmountPaid,
            stripe_invoice_id: session.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', invoiceId);

        if (isPaidInFull) {
          // Unlock portal access
          await unlockPortalAccess({
            userId: inv.user_id,
            inquiryId: inv.inquiry_id,
            customerEmail,
          });

          // Trigger post-payment sequence
          const paymentIntentId =
            typeof session.payment_intent === 'string'
              ? session.payment_intent
              : session.payment_intent?.id ?? session.id;

          await triggerPostPaymentSequence({
            recipientEmail: customerEmail,
            recipientName: customerName || 'Valued Client',
            service: `Invoice ${inv.invoice_number}`,
            amount: amountPaid,
            paymentType: 'invoice_payment',
            paymentIntentId,
            inquiryId: inv.inquiry_id,
          });
        }

        console.log(`[stripe-webhook] checkout.session.completed: Invoice ${invoiceId} → ${isPaidInFull ? 'paid' : 'partial'}`);
        break;
      }

      // ── customer.subscription.created ─────────────────────────────────────
      case 'customer.subscription.created': {
        const sub = event.data.object as Stripe.Subscription;
        const item = sub.items?.data?.[0];

        // Update retainer subscription record
        await supabase
          .from('retainer_subscriptions')
          .update({
            status: sub.status,
            stripe_price_id: item?.price?.id ?? null,
            current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            cancel_at_period_end: sub.cancel_at_period_end,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', sub.id);

        // Unlock portal access for the subscriber
        const { data: subRecord } = await supabase
          .from('retainer_subscriptions')
          .select('user_id, inquiry_id, customer_email, customer_name, plan_name')
          .eq('stripe_subscription_id', sub.id)
          .maybeSingle();

        if (subRecord) {
          await unlockPortalAccess({
            userId: subRecord.user_id,
            inquiryId: subRecord.inquiry_id,
            customerEmail: subRecord.customer_email,
            accessLevel: 'retainer',
          });

          // Trigger post-payment sequence for new subscription
          if (subRecord.customer_email) {
            await triggerPostPaymentSequence({
              recipientEmail: subRecord.customer_email,
              recipientName: subRecord.customer_name ?? 'Valued Client',
              service: subRecord.plan_name ?? 'Monthly Retainer',
              amount: (item?.price?.unit_amount ?? 0) / 100,
              paymentType: 'retainer_subscription',
              paymentIntentId: sub.id,
              inquiryId: subRecord.inquiry_id,
            });
          }
        }

        console.log(`[stripe-webhook] customer.subscription.created: ${sub.id} — status: ${sub.status}`);
        break;
      }

      // ── customer.subscription.updated ─────────────────────────────────────
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const item = sub.items?.data?.[0];

        await supabase
          .from('retainer_subscriptions')
          .update({
            status: sub.status,
            stripe_price_id: item?.price?.id ?? null,
            current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            cancel_at_period_end: sub.cancel_at_period_end,
            canceled_at: sub.canceled_at
              ? new Date(sub.canceled_at * 1000).toISOString()
              : null,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', sub.id);

        console.log(`[stripe-webhook] customer.subscription.updated: ${sub.id} — status: ${sub.status}`);
        break;
      }

      // ── customer.subscription.deleted ─────────────────────────────────────
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;

        await supabase
          .from('retainer_subscriptions')
          .update({
            status: 'canceled',
            canceled_at: sub.canceled_at
              ? new Date(sub.canceled_at * 1000).toISOString()
              : new Date().toISOString(),
            cancel_at_period_end: false,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', sub.id);

        // Revoke portal access (downgrade to limited)
        const { data: subRecord } = await supabase
          .from('retainer_subscriptions')
          .select('user_id, inquiry_id, customer_email, customer_name, plan_name, current_period_end')
          .eq('stripe_subscription_id', sub.id)
          .maybeSingle();

        if (subRecord?.user_id) {
          await supabase
            .from('client_portal_access')
            .update({
              access_level: 'limited',
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', subRecord.user_id);
        }

        // Notify admin
        if (subRecord) {
          await sendAdminEmail(
            `🔴 Retainer Cancelled — ${subRecord.customer_name ?? subRecord.customer_email}`,
            `<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:24px;background:#FAF7F2;border-radius:10px;border:1px solid #D9D0C5;">
              <h2 style="color:#c0392b;margin:0 0 16px;">🔴 Retainer Subscription Cancelled</h2>
              <table style="width:100%;border-collapse:collapse;font-size:14px;">
                <tr><td style="padding:8px 0;color:#7A6B5D;width:40%;border-bottom:1px solid #EDE8E0;">Client</td><td style="padding:8px 0;color:#2C1F14;border-bottom:1px solid #EDE8E0;">${subRecord.customer_name ?? '—'} &lt;${subRecord.customer_email ?? '—'}&gt;</td></tr>
                <tr><td style="padding:8px 0;color:#7A6B5D;border-bottom:1px solid #EDE8E0;">Plan</td><td style="padding:8px 0;color:#2C1F14;border-bottom:1px solid #EDE8E0;">${subRecord.plan_name ?? '—'}</td></tr>
                <tr><td style="padding:8px 0;color:#7A6B5D;border-bottom:1px solid #EDE8E0;">Access Until</td><td style="padding:8px 0;color:#2C1F14;border-bottom:1px solid #EDE8E0;">${subRecord.current_period_end ? new Date(subRecord.current_period_end).toLocaleDateString('en-US') : '—'}</td></tr>
                <tr><td style="padding:8px 0;color:#7A6B5D;">Subscription ID</td><td style="padding:8px 0;font-size:12px;font-family:monospace;color:#7A6B5D;">${sub.id}</td></tr>
              </table>
              <p style="margin:20px 0 0;font-size:13px;color:#7A6B5D;"><a href="${SITE_URL}/admin" style="color:#C8965A;">View in admin dashboard</a></p>
            </div>`
          );
        }

        console.log(`[stripe-webhook] customer.subscription.deleted: ${sub.id}`);
        break;
      }

      // ── charge.refunded ───────────────────────────────────────────────────
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId =
          typeof charge.payment_intent === 'string' ? charge.payment_intent : null;
        const amountRefunded = charge.amount_refunded / 100;
        const customerEmail =
          typeof charge.billing_details?.email === 'string' ? charge.billing_details.email : '';
        const customerName =
          typeof charge.billing_details?.name === 'string' ? charge.billing_details.name : '';

        // Find and update the invoice
        if (paymentIntentId) {
          const { data: inv } = await supabase
            .from('client_invoices')
            .select('id, invoice_number, status')
            .eq('stripe_invoice_id', paymentIntentId)
            .maybeSingle();

          if (inv) {
            const isFullRefund = charge.refunded;
            await supabase
              .from('client_invoices')
              .update({
                status: isFullRefund ? 'refunded' : 'partial_refund',
                updated_at: new Date().toISOString(),
              })
              .eq('id', inv.id);

            console.log(`[stripe-webhook] charge.refunded: Invoice ${inv.id} → ${isFullRefund ? 'refunded' : 'partial_refund'}`);
          }
        }

        // Notify admin
        await sendAdminEmail(
          `↩️ Refund Issued — $${amountRefunded.toFixed(2)} — ${customerName || customerEmail}`,
          `<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:24px;background:#FAF7F2;border-radius:10px;border:1px solid #D9D0C5;">
            <h2 style="color:#e67e22;margin:0 0 16px;">↩️ Refund Issued</h2>
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <tr><td style="padding:8px 0;color:#7A6B5D;width:40%;border-bottom:1px solid #EDE8E0;">Client</td><td style="padding:8px 0;color:#2C1F14;border-bottom:1px solid #EDE8E0;">${customerName || '—'} &lt;${customerEmail || '—'}&gt;</td></tr>
              <tr><td style="padding:8px 0;color:#7A6B5D;border-bottom:1px solid #EDE8E0;">Amount Refunded</td><td style="padding:8px 0;font-weight:bold;color:#e67e22;border-bottom:1px solid #EDE8E0;">$${amountRefunded.toFixed(2)}</td></tr>
              <tr><td style="padding:8px 0;color:#7A6B5D;border-bottom:1px solid #EDE8E0;">Full Refund</td><td style="padding:8px 0;color:#2C1F14;border-bottom:1px solid #EDE8E0;">${charge.refunded ? 'Yes' : 'No (Partial)'}</td></tr>
              <tr><td style="padding:8px 0;color:#7A6B5D;">Charge ID</td><td style="padding:8px 0;font-size:12px;font-family:monospace;color:#7A6B5D;">${charge.id}</td></tr>
            </table>
            <p style="margin:20px 0 0;font-size:13px;color:#7A6B5D;"><a href="${SITE_URL}/admin" style="color:#C8965A;">View in admin dashboard</a></p>
          </div>`
        );

        break;
      }

      default:
        // Acknowledge all other events without processing
        console.log(`[stripe-webhook] Unhandled event type: ${event.type}`);
        break;
    }

    return NextResponse.json({ received: true, event: event.type });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Webhook processing failed';
    console.error('[stripe-webhook] processing error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
