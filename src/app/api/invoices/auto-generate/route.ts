import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const RESEND_API_KEY = process.env.RESEND_API_KEY ?? '';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'maggimaybroussard@gmail.com';

// ─── POST /api/invoices/auto-generate ─────────────────────────────────────────
// Triggered after a Stripe payment completes to auto-generate and email a branded invoice
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      paymentIntentId,
      clientEmail,
      clientName,
      amount,
      currency = 'usd',
      description,
      invoiceId,
      lineItems,
    } = body;

    if (!paymentIntentId && !clientEmail) {
      return NextResponse.json({ error: 'paymentIntentId or clientEmail required' }, { status: 400 });
    }

    const supabase = await createClient();

    // ── 1. Resolve payment details from Stripe if needed ─────────────────────
    let resolvedAmount = amount;
    let resolvedEmail = clientEmail;
    let resolvedName = clientName;
    let resolvedDescription = description;

    if (paymentIntentId && !resolvedAmount) {
      try {
        const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
        resolvedAmount = pi.amount / 100;
        resolvedEmail = resolvedEmail || pi.metadata?.customer_email || pi.receipt_email || '';
        resolvedName = resolvedName || pi.metadata?.customer_name || '';
        resolvedDescription = resolvedDescription || pi.description || `Payment ${paymentIntentId}`;
      } catch {
        // continue with provided values
      }
    }

    if (!resolvedAmount || !resolvedEmail) {
      return NextResponse.json({ error: 'Could not resolve payment details' }, { status: 400 });
    }

    // ── 2. Look up or create invoice record ───────────────────────────────────
    let invoice: { id: string; invoice_number: string } | null = null;

    if (invoiceId) {
      const { data } = await supabase
        .from('client_invoices')
        .select('id, invoice_number')
        .eq('id', invoiceId)
        .maybeSingle();
      invoice = data;
    }

    if (!invoice && paymentIntentId) {
      const { data } = await supabase
        .from('client_invoices')
        .select('id, invoice_number')
        .eq('stripe_invoice_id', paymentIntentId)
        .maybeSingle();
      invoice = data;
    }

    const invoiceNumber = invoice?.invoice_number ?? `INV-${Date.now()}`;
    const amountFormatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(resolvedAmount);

    const paidDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // ── 3. Build branded invoice HTML ─────────────────────────────────────────
    const lineItemsHtml = lineItems?.length
      ? lineItems.map((item: { description: string; amount: number }) => `
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #EDE8E0;color:#2C1F14;">${item.description}</td>
            <td style="padding:10px 0;border-bottom:1px solid #EDE8E0;text-align:right;font-weight:600;color:#2C1F14;">
              ${new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(item.amount)}
            </td>
          </tr>
        `).join('')
      : `<tr>
          <td style="padding:10px 0;border-bottom:1px solid #EDE8E0;color:#2C1F14;">${resolvedDescription || 'Legal Services'}</td>
          <td style="padding:10px 0;border-bottom:1px solid #EDE8E0;text-align:right;font-weight:600;color:#2C1F14;">${amountFormatted}</td>
        </tr>`;

    const invoiceHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Invoice ${invoiceNumber}</title></head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:Georgia,serif;">
  <div style="max-width:680px;margin:40px auto;background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    
    <!-- Header -->
    <div style="background:#1B2A4A;padding:32px 40px;display:flex;align-items:center;justify-content:space-between;">
      <div>
        <h1 style="margin:0;color:#FFFFFF;font-size:22px;font-weight:700;letter-spacing:0.5px;">BROUSSARD LEGAL SERVICES</h1>
        <p style="margin:4px 0 0;color:#A8B8D0;font-size:13px;">maggimaybroussard@gmail.com</p>
      </div>
      <div style="text-align:right;">
        <p style="margin:0;color:#C8965A;font-size:18px;font-weight:700;">INVOICE</p>
        <p style="margin:4px 0 0;color:#A8B8D0;font-size:13px;">${invoiceNumber}</p>
      </div>
    </div>

    <!-- Invoice Details -->
    <div style="padding:32px 40px;background:#FAF7F2;border-bottom:1px solid #EDE8E0;">
      <div style="display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap;">
        <div>
          <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#7A6B5D;font-weight:600;">Bill To</p>
          <p style="margin:0;font-size:15px;font-weight:600;color:#1B2A4A;">${resolvedName || resolvedEmail}</p>
          <p style="margin:2px 0 0;font-size:13px;color:#7A6B5D;">${resolvedEmail}</p>
        </div>
        <div style="text-align:right;">
          <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#7A6B5D;font-weight:600;">Invoice Date</p>
          <p style="margin:0;font-size:14px;color:#1B2A4A;">${paidDate}</p>
          <p style="margin:8px 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#7A6B5D;font-weight:600;">Status</p>
          <span style="display:inline-block;padding:3px 10px;background:#D1FAE5;color:#065F46;border-radius:20px;font-size:12px;font-weight:600;">PAID</span>
        </div>
      </div>
    </div>

    <!-- Line Items -->
    <div style="padding:32px 40px;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="text-align:left;padding:0 0 12px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#7A6B5D;border-bottom:2px solid #1B2A4A;">Description</th>
            <th style="text-align:right;padding:0 0 12px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#7A6B5D;border-bottom:2px solid #1B2A4A;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${lineItemsHtml}
        </tbody>
        <tfoot>
          <tr>
            <td style="padding:16px 0 0;font-size:16px;font-weight:700;color:#1B2A4A;">Total Paid</td>
            <td style="padding:16px 0 0;text-align:right;font-size:20px;font-weight:700;color:#2d6a4f;">${amountFormatted}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Footer -->
    <div style="padding:24px 40px;background:#FAF7F2;border-top:1px solid #EDE8E0;text-align:center;">
      <p style="margin:0;font-size:12px;color:#7A6B5D;">Thank you for your business. This invoice confirms payment received in full.</p>
      <p style="margin:8px 0 0;font-size:11px;color:#A89880;">Broussard Legal Services · Louisiana · maggimaybroussard@gmail.com</p>
    </div>
  </div>
</body>
</html>`;

    // ── 4. Send invoice email to client ───────────────────────────────────────
    let emailSent = false;
    if (RESEND_API_KEY && resolvedEmail) {
      try {
        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: 'Broussard Legal Services <maggimay@broussardlegalservices.com>',
            to: [resolvedEmail],
            subject: `Invoice ${invoiceNumber} — Payment Confirmed — ${amountFormatted}`,
            html: invoiceHtml,
          }),
        });
        emailSent = emailRes.ok;
      } catch {
        // non-fatal
      }
    }

    // ── 5. Log invoice email ──────────────────────────────────────────────────
    if (invoice?.id) {
      await supabase.from('invoice_email_logs').insert({
        invoice_id: invoice.id,
        email_type: 'auto_invoice',
        recipient_email: resolvedEmail,
        sent_at: new Date().toISOString(),
        status: emailSent ? 'sent' : 'failed',
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      invoiceNumber,
      emailSent,
      amount: resolvedAmount,
      currency,
    });
  } catch (err) {
    console.error('[auto-generate-invoice] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Invoice generation failed' },
      { status: 500 }
    );
  }
}
