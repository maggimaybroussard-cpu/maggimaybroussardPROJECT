import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { sendDepositInvoiceAndReceipt } from '@/lib/email/depositEmails';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
// Reuse the invoice webhook secret — register this endpoint under the same webhook in Stripe
// or set STRIPE_PAYMENT_INTENT_WEBHOOK_SECRET separately if you prefer isolation.
const webhookSecret = process.env.STRIPE_PAYMENT_INTENT_WEBHOOK_SECRET
  ?? process.env.STRIPE_INVOICE_WEBHOOK_SECRET
  ?? '';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'maggimaybroussard@gmail.com';

// ─── Helper: call notify-client edge function ─────────────────────────────────
async function callNotifyClient(payload: Record<string, unknown>): Promise<void> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/notify-client`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('[stripe-payment-intent-webhook] notify-client error:', err);
    }
  } catch (err) {
    console.error('[stripe-payment-intent-webhook] notify-client fetch error:', err);
  }
}

// ─── Helper: send admin notification via Resend directly ─────────────────────
async function notifyAdmin(subject: string, html: string): Promise<void> {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
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
    console.error('[stripe-payment-intent-webhook] admin notify error:', err);
  }
}

// ─── Webhook Handler ──────────────────────────────────────────────────────────
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
    console.error('[stripe-payment-intent-webhook] signature error:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Only handle payment_intent.succeeded
  if (event.type !== 'payment_intent.succeeded') {
    return NextResponse.json({ received: true, event: event.type });
  }

  const pi = event.data.object as Stripe.PaymentIntent;

  // Skip onboarding retainer payments — handled by stripe-onboarding webhook
  if (pi.metadata?.payment_type === 'onboarding_retainer') {
    console.log('[stripe-payment-intent-webhook] Skipping onboarding_retainer PI:', pi.id);
    return NextResponse.json({ received: true, skipped: 'onboarding_retainer' });
  }

  // ── Handle consultation deposit / retainer booking payments ──────────────
  const isBookingPayment =
    pi.metadata?.payment_type === 'consultation_deposit' ||
    pi.metadata?.payment_type === 'retainer';

  if (isBookingPayment) {
    return handleBookingPayment(pi);
  }

  const supabase = await createClient();

  try {
    const amountPaid = pi.amount / 100;
    const currency = pi.currency ?? 'usd';

    // ── 1. Resolve the matching invoice ──────────────────────────────────────
    // Look up by stripe_payment_intent_id first, then fall back to metadata.invoice_id
    const invoiceId = pi.metadata?.invoice_id ?? null;

    let invoice: {
      id: string;
      invoice_number: string;
      amount: number;
      amount_paid: number;
      status: string;
      inquiry_id: string | null;
      user_id: string | null;
      currency: string;
      line_items: unknown[];
      notes: string | null;
      due_date: string;
      invoice_date: string;
    } | null = null;

    if (invoiceId) {
      const { data, error } = await supabase
        .from('client_invoices')
        .select('id, invoice_number, amount, amount_paid, status, inquiry_id, user_id, currency, line_items, notes, due_date, invoice_date')
        .eq('id', invoiceId)
        .maybeSingle();
      if (!error) invoice = data;
    }

    // Fallback: match by stripe_invoice_id (payment_intent id stored there on checkout)
    if (!invoice) {
      const { data, error } = await supabase
        .from('client_invoices')
        .select('id, invoice_number, amount, amount_paid, status, inquiry_id, user_id, currency, line_items, notes, due_date, invoice_date')
        .eq('stripe_invoice_id', pi.id)
        .maybeSingle();
      if (!error) invoice = data;
    }

    if (!invoice) {
      console.log('[stripe-payment-intent-webhook] No matching invoice for PI:', pi.id, '— logging receipt only.');
      // Still log the receipt even if no invoice matched
      await supabase.from('paid_receipt_logs').insert({
        payment_intent_id: pi.id,
        amount: amountPaid,
        currency,
        customer_email: pi.metadata?.customer_email ?? pi.receipt_email ?? null,
        customer_name: pi.metadata?.customer_name ?? null,
        invoice_id: null,
        invoice_number: null,
        status: 'no_invoice_match',
        raw_metadata: pi.metadata ?? {},
        created_at: new Date().toISOString(),
      });
      return NextResponse.json({ received: true, note: 'no_invoice_match' });
    }

    // ── 2. Idempotency guard ──────────────────────────────────────────────────
    if (invoice.status === 'paid') {
      console.log('[stripe-payment-intent-webhook] Invoice already paid, skipping:', invoice.id);
      return NextResponse.json({ received: true, skipped: 'already_paid' });
    }

    // ── 3. Update invoice status to paid ─────────────────────────────────────
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
        stripe_invoice_id: pi.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoice.id);

    if (updateError) {
      console.error('[stripe-payment-intent-webhook] Failed to update invoice:', updateError);
      return NextResponse.json({ error: 'Invoice update failed' }, { status: 500 });
    }

    // ── 4. Log the paid receipt ───────────────────────────────────────────────
    await supabase.from('paid_receipt_logs').insert({
      payment_intent_id: pi.id,
      amount: amountPaid,
      currency,
      customer_email: pi.metadata?.customer_email ?? pi.receipt_email ?? null,
      customer_name: pi.metadata?.customer_name ?? null,
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      status: isPaidInFull ? 'paid_in_full' : 'partial',
      raw_metadata: pi.metadata ?? {},
      created_at: new Date().toISOString(),
    });

    // ── 5. Resolve client contact details ─────────────────────────────────────
    let clientEmail = pi.metadata?.customer_email ?? pi.receipt_email ?? '';
    let clientName = pi.metadata?.customer_name ?? '';

    // Try to get from portal access / user profile if not in metadata
    if ((!clientEmail || !clientName) && invoice.user_id) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('full_name, email')
        .eq('user_id', invoice.user_id)
        .maybeSingle();
      if (profile) {
        clientEmail = clientEmail || profile.email || '';
        clientName = clientName || profile.full_name || '';
      }
    }

    if ((!clientEmail || !clientName) && invoice.inquiry_id) {
      const { data: inquiry } = await supabase
        .from('contact_inquiries')
        .select('name, email')
        .eq('id', invoice.inquiry_id)
        .maybeSingle();
      if (inquiry) {
        clientEmail = clientEmail || inquiry.email || '';
        clientName = clientName || inquiry.name || '';
      }
    }

    const amountFormatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amountPaid);

    const paidDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // ── 6. Send paid-receipt email to client via notify-client ────────────────
    if (clientEmail) {
      await callNotifyClient({
        clientEmail,
        clientName: clientName || clientEmail,
        eventType: 'paid_receipt',
        inquiryId: invoice.inquiry_id,
        details: {
          invoiceNumber: invoice.invoice_number,
          amount: amountPaid,
          amountFormatted,
          currency,
          paymentIntentId: pi.id,
          paidDate,
          isPaidInFull,
          totalAmount: invoice.amount,
          description: pi.description ?? `Invoice ${invoice.invoice_number}`,
        },
      });
    }

    // ── 7. Notify admin ───────────────────────────────────────────────────────
    const adminHtml = `
      <div style="font-family:Georgia,serif; max-width:600px; margin:0 auto; padding:24px; background:#FAF7F2; border-radius:10px; border:1px solid #D9D0C5;">
        <h2 style="color:#4A3728; margin:0 0 16px; font-size:20px;">&#9989; Invoice Paid — ${invoice.invoice_number}</h2>
        <table style="width:100%; border-collapse:collapse; font-size:14px;">
          <tr><td style="padding:8px 0; color:#7A6B5D; width:40%; border-bottom:1px solid #EDE8E0;">Invoice #</td><td style="padding:8px 0; font-weight:bold; color:#2C1F14; border-bottom:1px solid #EDE8E0;">${invoice.invoice_number}</td></tr>
          <tr><td style="padding:8px 0; color:#7A6B5D; border-bottom:1px solid #EDE8E0;">Client</td><td style="padding:8px 0; color:#2C1F14; border-bottom:1px solid #EDE8E0;">${clientName || '—'} &lt;${clientEmail || '—'}&gt;</td></tr>
          <tr><td style="padding:8px 0; color:#7A6B5D; border-bottom:1px solid #EDE8E0;">Amount Paid</td><td style="padding:8px 0; font-size:18px; font-weight:bold; color:#2d6a4f; border-bottom:1px solid #EDE8E0;">${amountFormatted}</td></tr>
          <tr><td style="padding:8px 0; color:#7A6B5D; border-bottom:1px solid #EDE8E0;">Status</td><td style="padding:8px 0; color:#2d6a4f; font-weight:bold; border-bottom:1px solid #EDE8E0;">${isPaidInFull ? 'Paid in Full' : 'Partial Payment'}</td></tr>
          <tr><td style="padding:8px 0; color:#7A6B5D; border-bottom:1px solid #EDE8E0;">Date</td><td style="padding:8px 0; color:#2C1F14; border-bottom:1px solid #EDE8E0;">${paidDate}</td></tr>
          <tr><td style="padding:8px 0; color:#7A6B5D;">Payment Intent</td><td style="padding:8px 0; color:#7A6B5D; font-size:12px; font-family:monospace;">${pi.id}</td></tr>
        </table>
        <p style="margin:20px 0 0; font-size:13px; color:#7A6B5D;">A paid receipt has been automatically sent to the client. View the invoice in the <a href="https://broussardlegalservices.com/admin" style="color:#C8965A;">admin dashboard</a>.</p>
      </div>
    `;

    await notifyAdmin(
      `✅ Invoice Paid — ${invoice.invoice_number} — ${amountFormatted}`,
      adminHtml
    );

    // ── 8. GA4 Measurement Protocol: workflow funnel step 5 ──────────────────
    const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    const GA_API_SECRET = process.env.GA_API_SECRET;
    if (GA_MEASUREMENT_ID) {
      try {
        const gaUrl = `https://www.google-analytics.com/mp/collect?measurement_id=${GA_MEASUREMENT_ID}${GA_API_SECRET ? `&api_secret=${GA_API_SECRET}` : ''}`;
        await fetch(gaUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: clientEmail || pi.id,
            events: [{
              name: 'workflow_payment_collected',
              params: {
                event_category: 'workflow_funnel',
                funnel_step: 5,
                funnel_step_name: 'payment_collected',
                case_id: invoice.inquiry_id ?? '',
                payment_type: 'invoice',
                value: amountPaid,
                currency: currency.toUpperCase(),
                transaction_id: pi.id,
              },
            }],
          }),
        });
      } catch { /* non-blocking */ }
    }

    // ── 9. Auto-generate and email branded invoice ────────────────────────────
    if (isPaidInFull && clientEmail) {
      try {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://maggimaybr6854.builtwithrocket.new';
        await fetch(`${siteUrl}/api/invoices/auto-generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentIntentId: pi.id,
            clientEmail,
            clientName,
            amount: amountPaid,
            currency,
            description: pi.description ?? `Invoice ${invoice.invoice_number}`,
            invoiceId: invoice.id,
          }),
        });
      } catch { /* non-blocking */ }
    }

    console.log(
      `[stripe-payment-intent-webhook] Invoice ${invoice.id} marked ${isPaidInFull ? 'paid' : 'partial'} — ${amountFormatted} — PI: ${pi.id}`
    );

    return NextResponse.json({ received: true, invoiceId: invoice.id, status: isPaidInFull ? 'paid' : 'partial' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Webhook processing failed';
    console.error('[stripe-payment-intent-webhook] error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── Booking Deposit / Retainer Payment Handler ───────────────────────────────
async function handleBookingPayment(pi: Stripe.PaymentIntent): Promise<NextResponse> {
  const supabase = await createClient();
  const RESEND_API_KEY = process.env.RESEND_API_KEY ?? '';

  const amountPaid = pi.amount / 100;
  const currency = pi.currency ?? 'usd';
  let clientEmail = pi.metadata?.customer_email ?? pi.receipt_email ?? '';
  let clientName = pi.metadata?.customer_name ?? clientEmail;
  const paymentType = pi.metadata?.payment_type ?? 'consultation_deposit';
  const invoiceId = pi.metadata?.invoice_id ?? null;

  const paidDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // ── 1. Resolve invoice record ─────────────────────────────────────────────
  let invoiceNumber = `INV-${Date.now()}`;
  let resolvedInvoiceId = invoiceId;

  if (invoiceId) {
    const { data: inv } = await supabase
      .from('client_invoices')
      .select('id, invoice_number, status')
      .eq('id', invoiceId)
      .maybeSingle();

    if (inv) {
      invoiceNumber = inv.invoice_number;
      // Idempotency: skip if already paid
      if (inv.status === 'paid') {
        console.log('[stripe-payment-intent-webhook] Booking invoice already paid:', inv.id);
        return NextResponse.json({ received: true, skipped: 'already_paid' });
      }
    }
  } else {
    // Fallback: find by stripe_invoice_id (PI id stored there)
    const { data: inv } = await supabase
      .from('client_invoices')
      .select('id, invoice_number, status')
      .eq('stripe_invoice_id', pi.id)
      .maybeSingle();

    if (inv) {
      invoiceNumber = inv.invoice_number;
      resolvedInvoiceId = inv.id;
      if (inv.status === 'paid') {
        return NextResponse.json({ received: true, skipped: 'already_paid' });
      }
    }
  }

  // ── 2. Mark invoice as paid ───────────────────────────────────────────────
  if (resolvedInvoiceId) {
    await supabase
      .from('client_invoices')
      .update({
        status: 'paid',
        amount_paid: amountPaid,
        stripe_invoice_id: pi.id,
        invoice_sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', resolvedInvoiceId);
  }

  // ── 3. Log paid receipt ───────────────────────────────────────────────────
  await supabase.from('paid_receipt_logs').insert({
    payment_intent_id: pi.id,
    amount: amountPaid,
    currency,
    customer_email: clientEmail || null,
    customer_name: clientName || null,
    invoice_id: resolvedInvoiceId,
    invoice_number: invoiceNumber,
    status: 'paid_in_full',
    raw_metadata: pi.metadata ?? {},
    created_at: new Date().toISOString(),
  });

  // ── 4. Send invoice + receipt emails via Resend ───────────────────────────
  if (clientEmail && RESEND_API_KEY && RESEND_API_KEY !== 'your-resend-api-key-here') {
    const { invoiceSent, receiptSent, errors } = await sendDepositInvoiceAndReceipt({
      resendApiKey: RESEND_API_KEY,
      clientEmail,
      clientName: clientName || clientEmail,
      paymentType,
      amount: amountPaid,
      currency,
      invoiceNumber,
      paymentIntentId: pi.id,
      paidDate,
    });

    // Update invoice sent timestamps
    if (resolvedInvoiceId && (invoiceSent || receiptSent)) {
      await supabase
        .from('client_invoices')
        .update({
          invoice_sent_at: invoiceSent ? new Date().toISOString() : undefined,
          receipt_sent_at: receiptSent ? new Date().toISOString() : undefined,
        })
        .eq('id', resolvedInvoiceId);
    }

    if (errors.length > 0) {
      console.error('[stripe-payment-intent-webhook] Email errors:', errors);
    }

    console.log(
      `[stripe-payment-intent-webhook] Booking payment processed — ${paymentType} — ${amountPaid} — invoiceSent:${invoiceSent} receiptSent:${receiptSent}`
    );
  }

  // ── 4b. Auto-generate engagement letter after deposit ─────────────────────
  if (paymentType === 'consultation_deposit' && clientEmail) {
    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://broussardlegalservices.com';
      await fetch(`${siteUrl}/api/engagement-letter/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: clientName || clientEmail,
          clientEmail,
          paymentIntentId: pi.id,
          invoiceId: resolvedInvoiceId ?? undefined,
          retainerAmount: amountPaid,
        }),
      });
      console.log('[stripe-payment-intent-webhook] Engagement letter generated for:', clientEmail);
    } catch (engErr) {
      console.error('[stripe-payment-intent-webhook] Engagement letter generation error:', engErr);
      // Non-fatal — letter can be generated manually from admin
    }
  }

  // ── 5. Notify admin ───────────────────────────────────────────────────────
  const amountFormatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amountPaid);

  const label =
    paymentType === 'consultation_deposit' ?'Consultation Deposit'
      : paymentType === 'retainer' ?'Monthly Retainer' :'Payment';

  await notifyAdmin(
    `✅ ${label} Received — ${amountFormatted} — ${clientName || clientEmail}`,
    `<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:24px;background:#FAF7F2;border-radius:10px;border:1px solid #D9D0C5;">
      <h2 style="color:#4A3728;margin:0 0 16px;font-size:20px;">&#9989; ${label} Received</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:8px 0;color:#7A6B5D;width:40%;border-bottom:1px solid #EDE8E0;">Client</td><td style="padding:8px 0;font-weight:bold;color:#2C1F14;border-bottom:1px solid #EDE8E0;">${clientName || '—'} &lt;${clientEmail || '—'}&gt;</td></tr>
        <tr><td style="padding:8px 0;color:#7A6B5D;border-bottom:1px solid #EDE8E0;">Type</td><td style="padding:8px 0;color:#2C1F14;border-bottom:1px solid #EDE8E0;">${label}</td></tr>
        <tr><td style="padding:8px 0;color:#7A6B5D;border-bottom:1px solid #EDE8E0;">Amount</td><td style="padding:8px 0;font-size:18px;font-weight:bold;color:#2d6a4f;border-bottom:1px solid #EDE8E0;">${amountFormatted}</td></tr>
        <tr><td style="padding:8px 0;color:#7A6B5D;border-bottom:1px solid #EDE8E0;">Invoice</td><td style="padding:8px 0;color:#2C1F14;border-bottom:1px solid #EDE8E0;">${invoiceNumber}</td></tr>
        <tr><td style="padding:8px 0;color:#7A6B5D;border-bottom:1px solid #EDE8E0;">Date</td><td style="padding:8px 0;color:#2C1F14;border-bottom:1px solid #EDE8E0;">${paidDate}</td></tr>
        <tr><td style="padding:8px 0;color:#7A6B5D;">Payment Intent</td><td style="padding:8px 0;color:#7A6B5D;font-size:12px;font-family:monospace;">${pi.id}</td></tr>
      </table>
      <p style="margin:20px 0 0;font-size:13px;color:#7A6B5D;">Invoice and receipt emails have been sent to the client. <a href="https://broussardlegalservices.com/admin" style="color:#C8965A;">View in admin dashboard</a>.</p>
    </div>`
  );

  return NextResponse.json({
    received: true,
    type: 'booking_payment',
    paymentType,
    invoiceId: resolvedInvoiceId,
    invoiceNumber,
  });
}
