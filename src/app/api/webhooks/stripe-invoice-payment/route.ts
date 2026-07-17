import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_INVOICE_WEBHOOK_SECRET ?? '';

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? '';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'maggimaybroussard@gmail.com';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://broussardlegalservices.com';

const brand = {
  bg: '#FAF7F2',
  bgCard: '#FFFFFF',
  primary: '#4A3728',
  accent: '#C8965A',
  accentLight: '#F5EDE0',
  foreground: '#2C1F14',
  muted: '#7A6B5D',
  border: '#D9D0C5',
  secondary: '#EDE8E0',
  white: '#FFFFFF',
  success: '#2d6a4f',
  successLight: '#EAF2EB',
  warning: '#92400e',
  warningLight: '#FEF3C7',
};

// ─── Resend helper ────────────────────────────────────────────────────────────
async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!RESEND_API_KEY) return;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Broussard Legal Services <maggimay@broussardlegalservices.com>',
        to: [to],
        subject,
        html,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('[stripe-invoice-webhook] Resend error:', err);
    }
  } catch (err) {
    console.error('[stripe-invoice-webhook] Resend fetch error:', err);
  }
}

// ─── Email: Payment Confirmation ─────────────────────────────────────────────
function buildPaymentConfirmationEmail(
  clientName: string,
  invoiceNumber: string,
  amountFormatted: string,
  paidDate: string,
  paymentIntentId: string,
  invoiceUrl?: string | null
): string {
  const firstName = clientName.split(' ')[0] || clientName;
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0; padding:0; background-color:#EDE8E0; font-family: Georgia, 'Times New Roman', serif;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#EDE8E0; padding:40px 16px;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px; width:100%; background-color:${brand.bg}; border-radius:14px; overflow:hidden; border:1px solid ${brand.border}; box-shadow:0 4px 24px rgba(74,55,40,0.10);">
            <tr>
              <td style="background-color:${brand.primary}; padding:0;">
                <div style="height:4px; background:linear-gradient(to right,${brand.accent},#E8B87A,${brand.accent});"></div>
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="padding:28px 36px 24px;">
                  <tr>
                    <td>
                      <table cellpadding="0" cellspacing="0" role="presentation">
                        <tr>
                          <td style="border-right:2px solid ${brand.accent}; padding-right:14px; vertical-align:middle;">
                            <p style="margin:0; font-size:10px; color:${brand.accent}; letter-spacing:0.18em; text-transform:uppercase; font-family:Georgia,serif; line-height:1.4;">Paralegal</p>
                            <p style="margin:0; font-size:10px; color:${brand.accent}; letter-spacing:0.18em; text-transform:uppercase; font-family:Georgia,serif; line-height:1.4;">Services</p>
                          </td>
                          <td style="padding-left:14px; vertical-align:middle;">
                            <h1 style="margin:0; font-size:24px; color:${brand.white}; font-family:Georgia,'Times New Roman',serif; font-weight:normal; letter-spacing:0.01em; line-height:1.2;">Maggi May Broussard</h1>
                            <p style="margin:4px 0 0; font-size:12px; color:rgba(255,255,255,0.65); font-family:Georgia,serif; letter-spacing:0.06em;">Louisiana &amp; Nationwide</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
                <div style="height:1px; background:linear-gradient(to right,${brand.accent},rgba(200,150,90,0.2),transparent); margin:0 36px;"></div>
                <div style="height:20px;"></div>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 36px 32px;">
                <span style="display:inline-block; background-color:${brand.success}; color:${brand.white}; font-size:10px; font-weight:bold; letter-spacing:0.12em; text-transform:uppercase; padding:4px 14px; border-radius:20px; margin-bottom:22px; font-family:Georgia,serif;">&#10003;&nbsp; Payment Confirmed</span>
                <h2 style="margin:0 0 20px; font-size:21px; color:${brand.foreground}; font-family:Georgia,serif; font-weight:normal; border-bottom:1px solid ${brand.border}; padding-bottom:14px;">Thank You, ${firstName}</h2>
                <p style="margin:0 0 16px; font-size:15px; color:${brand.foreground}; line-height:1.8; font-family:Georgia,serif;">Your payment has been successfully processed. Please keep this email as your official receipt.</p>
                <div style="background-color:${brand.successLight}; border:1px solid #b7e0c8; border-radius:10px; overflow:hidden; margin:0 0 24px;">
                  <div style="background-color:${brand.success}; padding:10px 22px;">
                    <p style="margin:0; font-size:11px; color:${brand.white}; font-weight:bold; text-transform:uppercase; letter-spacing:0.12em; font-family:Georgia,serif;">Payment Receipt</p>
                  </div>
                  <div style="padding:20px 22px;">
                    <table style="width:100%; border-collapse:collapse; font-family:Georgia,serif;">
                      <tr>
                        <td style="padding:8px 0; color:${brand.muted}; font-size:13px; width:40%; border-bottom:1px solid rgba(217,208,197,0.5);">Invoice #</td>
                        <td style="padding:8px 0; color:${brand.foreground}; font-size:14px; font-weight:bold; border-bottom:1px solid rgba(217,208,197,0.5);">${invoiceNumber}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0; color:${brand.muted}; font-size:13px; border-bottom:1px solid rgba(217,208,197,0.5);">Amount Paid</td>
                        <td style="padding:8px 0; font-size:22px; font-weight:bold; color:${brand.success}; font-family:Georgia,serif; border-bottom:1px solid rgba(217,208,197,0.5);">${amountFormatted}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0; color:${brand.muted}; font-size:13px; border-bottom:1px solid rgba(217,208,197,0.5);">Date</td>
                        <td style="padding:8px 0; color:${brand.foreground}; font-size:14px; border-bottom:1px solid rgba(217,208,197,0.5);">${paidDate}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0; color:${brand.muted}; font-size:13px;">Transaction ID</td>
                        <td style="padding:8px 0; color:${brand.muted}; font-size:12px; font-family:monospace;">${paymentIntentId}</td>
                      </tr>
                    </table>
                  </div>
                </div>
                ${invoiceUrl ? `
                <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 20px;">
                  <tr>
                    <td style="background-color:${brand.accent}; border-radius:7px; box-shadow:0 2px 8px rgba(200,150,90,0.25);">
                      <a href="${invoiceUrl}" style="display:inline-block; padding:13px 28px; color:${brand.white}; text-decoration:none; font-size:13px; font-family:Georgia,serif; letter-spacing:0.05em; font-weight:bold;">View Invoice &amp; Receipt &rarr;</a>
                    </td>
                  </tr>
                </table>` : ''}
                <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 20px;">
                  <tr>
                    <td style="background-color:${brand.primary}; border-radius:7px;">
                      <a href="${SITE_URL}/portal/invoices" style="display:inline-block; padding:13px 28px; color:${brand.white}; text-decoration:none; font-size:13px; font-family:Georgia,serif; letter-spacing:0.05em; font-weight:bold;">View Payment History in Portal &rarr;</a>
                    </td>
                  </tr>
                </table>
                <table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:28px; border-top:1px solid ${brand.border}; padding-top:20px; width:100%;">
                  <tr>
                    <td>
                      <p style="margin:0 0 4px; font-size:15px; color:${brand.foreground}; font-family:Georgia,serif;">Warm regards,</p>
                      <p style="margin:0 0 2px; font-size:16px; color:${brand.primary}; font-weight:bold; font-family:Georgia,serif;">Maggi May Broussard</p>
                      <p style="margin:0 0 6px; font-size:12px; color:${brand.muted}; font-family:Georgia,serif; letter-spacing:0.04em;">Licensed Paralegal · Louisiana &amp; Nationwide</p>
                      <a href="mailto:maggimaybroussard@gmail.com" style="color:${brand.accent}; font-size:13px; text-decoration:none; font-family:Georgia,serif;">maggimaybroussard@gmail.com</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="background-color:${brand.secondary}; padding:20px 36px; border-top:1px solid ${brand.border};">
                <p style="margin:0; font-size:11px; color:${brand.muted}; font-family:Georgia,serif;">You received this because you have an active invoice with Maggi May Broussard Legal Services. <a href="${SITE_URL}/portal/login" style="color:${brand.accent}; text-decoration:none;">Access your portal</a></p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;
}

// ─── Email: Invoice Issued / Reminder ────────────────────────────────────────
function buildInvoiceIssuedEmail(
  clientName: string,
  invoiceNumber: string,
  amountFormatted: string,
  invoiceDate: string,
  dueDate: string,
  paymentLink: string | null,
  isReminder = false,
  daysOverdue = 0
): string {
  const firstName = clientName.split(' ')[0] || clientName;
  const badgeColor = isReminder ? brand.warning : brand.accent;
  const badgeBg = isReminder ? brand.warningLight : brand.accentLight;
  const badge = isReminder
    ? `&#9888;&nbsp; Invoice Reminder${daysOverdue > 0 ? ` — ${daysOverdue} Days Overdue` : ''}`
    : '&#128196;&nbsp; Invoice Issued';
  const headline = isReminder
    ? `Friendly Reminder: Invoice ${invoiceNumber}`
    : `Invoice ${invoiceNumber} — Action Required`;
  const intro = isReminder
    ? `This is a friendly reminder that invoice <strong>${invoiceNumber}</strong> for <strong>${amountFormatted}</strong> is due${daysOverdue > 0 ? ` and is now ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} past due` : ''}. Please arrange payment at your earliest convenience.`
    : `A new invoice has been issued for your account. Please review the details below and submit payment by the due date.`;

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0; padding:0; background-color:#EDE8E0; font-family:Georgia,'Times New Roman',serif;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#EDE8E0; padding:40px 16px;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px; width:100%; background-color:${brand.bg}; border-radius:14px; overflow:hidden; border:1px solid ${brand.border}; box-shadow:0 4px 24px rgba(74,55,40,0.10);">
            <tr>
              <td style="background-color:${brand.primary}; padding:0;">
                <div style="height:4px; background:linear-gradient(to right,${brand.accent},#E8B87A,${brand.accent});"></div>
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="padding:28px 36px 24px;">
                  <tr>
                    <td>
                      <table cellpadding="0" cellspacing="0" role="presentation">
                        <tr>
                          <td style="border-right:2px solid ${brand.accent}; padding-right:14px; vertical-align:middle;">
                            <p style="margin:0; font-size:10px; color:${brand.accent}; letter-spacing:0.18em; text-transform:uppercase; font-family:Georgia,serif; line-height:1.4;">Paralegal</p>
                            <p style="margin:0; font-size:10px; color:${brand.accent}; letter-spacing:0.18em; text-transform:uppercase; font-family:Georgia,serif; line-height:1.4;">Services</p>
                          </td>
                          <td style="padding-left:14px; vertical-align:middle;">
                            <h1 style="margin:0; font-size:24px; color:${brand.white}; font-family:Georgia,'Times New Roman',serif; font-weight:normal; letter-spacing:0.01em; line-height:1.2;">Maggi May Broussard</h1>
                            <p style="margin:4px 0 0; font-size:12px; color:rgba(255,255,255,0.65); font-family:Georgia,serif; letter-spacing:0.06em;">Louisiana &amp; Nationwide</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
                <div style="height:1px; background:linear-gradient(to right,${brand.accent},rgba(200,150,90,0.2),transparent); margin:0 36px;"></div>
                <div style="height:20px;"></div>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 36px 32px;">
                <span style="display:inline-block; background-color:${badgeColor}; color:${brand.white}; font-size:10px; font-weight:bold; letter-spacing:0.12em; text-transform:uppercase; padding:4px 14px; border-radius:20px; margin-bottom:22px; font-family:Georgia,serif;">${badge}</span>
                <h2 style="margin:0 0 20px; font-size:21px; color:${brand.foreground}; font-family:Georgia,serif; font-weight:normal; border-bottom:1px solid ${brand.border}; padding-bottom:14px;">Dear ${firstName},</h2>
                <p style="margin:0 0 20px; font-size:15px; color:${brand.foreground}; line-height:1.8; font-family:Georgia,serif;">${intro}</p>
                <div style="background-color:${brand.bgCard}; border:1px solid ${brand.border}; border-radius:10px; overflow:hidden; margin:0 0 24px;">
                  <div style="background-color:${brand.primary}; padding:10px 22px;">
                    <p style="margin:0; font-size:11px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.12em; font-family:Georgia,serif;">Invoice Details</p>
                  </div>
                  <div style="padding:20px 22px;">
                    <table style="width:100%; border-collapse:collapse; font-family:Georgia,serif;">
                      <tr>
                        <td style="padding:8px 0; color:${brand.muted}; font-size:13px; width:40%; border-bottom:1px solid rgba(217,208,197,0.5);">Invoice #</td>
                        <td style="padding:8px 0; color:${brand.foreground}; font-size:14px; font-weight:bold; border-bottom:1px solid rgba(217,208,197,0.5);">${invoiceNumber}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0; color:${brand.muted}; font-size:13px; border-bottom:1px solid rgba(217,208,197,0.5);">Amount Due</td>
                        <td style="padding:8px 0; font-size:22px; font-weight:bold; color:${isReminder ? brand.warning : brand.foreground}; font-family:Georgia,serif; border-bottom:1px solid rgba(217,208,197,0.5);">${amountFormatted}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0; color:${brand.muted}; font-size:13px; border-bottom:1px solid rgba(217,208,197,0.5);">Invoice Date</td>
                        <td style="padding:8px 0; color:${brand.foreground}; font-size:14px; border-bottom:1px solid rgba(217,208,197,0.5);">${invoiceDate}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0; color:${brand.muted}; font-size:13px;">Due Date</td>
                        <td style="padding:8px 0; color:${isReminder ? brand.warning : brand.foreground}; font-size:14px; font-weight:bold;">${dueDate}</td>
                      </tr>
                    </table>
                  </div>
                </div>
                ${paymentLink ? `
                <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 16px;">
                  <tr>
                    <td style="background-color:${brand.accent}; border-radius:7px; box-shadow:0 2px 8px rgba(200,150,90,0.25);">
                      <a href="${paymentLink}" style="display:inline-block; padding:14px 36px; color:${brand.white}; text-decoration:none; font-size:14px; font-family:Georgia,serif; letter-spacing:0.05em; font-weight:bold;">Pay Invoice Securely &rarr;</a>
                    </td>
                  </tr>
                </table>` : ''}
                <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 20px;">
                  <tr>
                    <td style="background-color:${brand.primary}; border-radius:7px;">
                      <a href="${SITE_URL}/portal/invoices" style="display:inline-block; padding:13px 28px; color:${brand.white}; text-decoration:none; font-size:13px; font-family:Georgia,serif; letter-spacing:0.05em; font-weight:bold;">View in Client Portal &rarr;</a>
                    </td>
                  </tr>
                </table>
                <div style="background-color:${brand.accentLight}; border-left:3px solid ${brand.accent}; padding:16px 20px; border-radius:0 8px 8px 0; margin:0 0 24px;">
                  <p style="margin:0; font-size:13px; color:${brand.foreground}; line-height:1.7; font-family:Georgia,serif;">Questions about this invoice? Reply to this email or contact us at <a href="mailto:maggimaybroussard@gmail.com" style="color:${brand.accent}; text-decoration:none;">maggimaybroussard@gmail.com</a></p>
                </div>
                <table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:28px; border-top:1px solid ${brand.border}; padding-top:20px; width:100%;">
                  <tr>
                    <td>
                      <p style="margin:0 0 4px; font-size:15px; color:${brand.foreground}; font-family:Georgia,serif;">Warm regards,</p>
                      <p style="margin:0 0 2px; font-size:16px; color:${brand.primary}; font-weight:bold; font-family:Georgia,serif;">Maggi May Broussard</p>
                      <p style="margin:0 0 6px; font-size:12px; color:${brand.muted}; font-family:Georgia,serif; letter-spacing:0.04em;">Licensed Paralegal · Louisiana &amp; Nationwide</p>
                      <a href="mailto:maggimaybroussard@gmail.com" style="color:${brand.accent}; font-size:13px; text-decoration:none; font-family:Georgia,serif;">maggimaybroussard@gmail.com</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="background-color:${brand.secondary}; padding:20px 36px; border-top:1px solid ${brand.border};">
                <p style="margin:0; font-size:11px; color:${brand.muted}; font-family:Georgia,serif;">You received this because you have an active invoice with Maggi May Broussard Legal Services. <a href="${SITE_URL}/portal/login" style="color:${brand.accent}; text-decoration:none;">Access your portal</a></p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;
}

// ─── Helper: resolve client details from Supabase ────────────────────────────
async function resolveClientDetails(
  supabase: Awaited<ReturnType<typeof createClient>>,
  invoice: { inquiry_id: string | null; user_id: string | null },
  fallbackEmail: string,
  fallbackName: string
): Promise<{ email: string; name: string }> {
  let email = fallbackEmail;
  let name = fallbackName;

  if ((!email || !name) && invoice.user_id) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('full_name, email')
      .eq('user_id', invoice.user_id)
      .maybeSingle();
    if (profile) {
      email = email || profile.email || '';
      name = name || profile.full_name || '';
    }
  }

  if ((!email || !name) && invoice.inquiry_id) {
    const { data: inquiry } = await supabase
      .from('contact_inquiries')
      .select('name, email')
      .eq('id', invoice.inquiry_id)
      .maybeSingle();
    if (inquiry) {
      email = email || inquiry.email || '';
      name = name || inquiry.name || '';
    }
  }

  return { email, name };
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
          .select('id, invoice_number, amount, amount_paid, status, inquiry_id, user_id, currency, due_date, invoice_date')
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

        // ── Send payment confirmation email via Resend ─────────────────────
        const { email: resolvedEmail, name: resolvedName } = await resolveClientDetails(
          supabase,
          invoice,
          customerEmail,
          customerName
        );

        if (resolvedEmail) {
          const amountFormatted = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: (invoice.currency || 'usd').toUpperCase(),
          }).format(amountPaid);
          const paidDate = new Date().toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric',
          });
          await sendEmail(
            resolvedEmail,
            `✅ Payment Confirmed — Invoice ${invoiceNumber || invoice.invoice_number}`,
            buildPaymentConfirmationEmail(
              resolvedName || resolvedEmail,
              invoiceNumber || invoice.invoice_number,
              amountFormatted,
              paidDate,
              paymentIntentId,
              null
            )
          );
          // Admin notification
          await sendEmail(
            ADMIN_EMAIL,
            `✅ Invoice Paid — ${invoiceNumber || invoice.invoice_number} — ${amountFormatted}`,
            `<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:24px;background:#FAF7F2;border-radius:10px;border:1px solid #D9D0C5;">
              <h2 style="color:#4A3728;margin:0 0 16px;">&#9989; Invoice Paid via Checkout</h2>
              <p><strong>Client:</strong> ${resolvedName || '—'} &lt;${resolvedEmail}&gt;</p>
              <p><strong>Invoice:</strong> ${invoiceNumber || invoice.invoice_number}</p>
              <p><strong>Amount:</strong> ${amountFormatted}</p>
              <p><strong>Date:</strong> ${paidDate}</p>
              <p><strong>Session:</strong> <code>${session.id}</code></p>
            </div>`
          );
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
          .select('id, invoice_number, amount, amount_paid, status, inquiry_id, user_id, currency, due_date, invoice_date')
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

        // ── Send payment confirmation email via Resend ─────────────────────
        const { email: resolvedEmail, name: resolvedName } = await resolveClientDetails(
          supabase,
          invoice,
          customerEmail,
          customerName
        );

        if (resolvedEmail) {
          const amountFormatted = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: (invoice.currency || 'usd').toUpperCase(),
          }).format(amountPaid);
          const paidDate = new Date().toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric',
          });
          await sendEmail(
            resolvedEmail,
            `✅ Payment Confirmed — Invoice ${invoice.invoice_number}`,
            buildPaymentConfirmationEmail(
              resolvedName || resolvedEmail,
              invoice.invoice_number,
              amountFormatted,
              paidDate,
              paymentIntentId,
              stripeInvoice.hosted_invoice_url
            )
          );
          // Admin notification
          await sendEmail(
            ADMIN_EMAIL,
            `✅ Invoice Paid — ${invoice.invoice_number} — ${amountFormatted}`,
            `<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:24px;background:#FAF7F2;border-radius:10px;border:1px solid #D9D0C5;">
              <h2 style="color:#4A3728;margin:0 0 16px;">&#9989; Invoice Paid via Stripe</h2>
              <p><strong>Client:</strong> ${resolvedName || '—'} &lt;${resolvedEmail}&gt;</p>
              <p><strong>Invoice:</strong> ${invoice.invoice_number}</p>
              <p><strong>Amount:</strong> ${amountFormatted}</p>
              <p><strong>Date:</strong> ${paidDate}</p>
              <p><strong>Stripe Invoice:</strong> <code>${stripeInvoice.id}</code></p>
              ${stripeInvoice.hosted_invoice_url ? `<p><a href="${stripeInvoice.hosted_invoice_url}" style="color:#C8965A;">View Stripe Invoice</a></p>` : ''}
            </div>`
          );
        }

        console.log(`[stripe-invoice-payment-webhook] invoice.paid: Invoice ${invoiceId} marked paid — Stripe ${stripeInvoice.id}`);
        break;
      }

      // ── Stripe Invoice payment failed — send reminder email ───────────────
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

        // ── Send payment failed / retry reminder email ─────────────────────
        const customerEmail = typeof stripeInvoice.customer_email === 'string' ? stripeInvoice.customer_email : '';
        const customerName = typeof stripeInvoice.customer_name === 'string' ? stripeInvoice.customer_name : '';

        const { data: invoice } = await supabase
          .from('client_invoices')
          .select('id, invoice_number, amount, currency, due_date, invoice_date, inquiry_id, user_id')
          .eq('id', invoiceId)
          .maybeSingle();

        if (invoice) {
          const { email: resolvedEmail, name: resolvedName } = await resolveClientDetails(
            supabase,
            invoice,
            customerEmail,
            customerName
          );

          if (resolvedEmail) {
            const amountFormatted = new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: (invoice.currency || 'usd').toUpperCase(),
            }).format(Number(invoice.amount));
            const dueDate = invoice.due_date
              ? new Date(invoice.due_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
              : 'Please pay promptly';
            const invoiceDate = invoice.invoice_date
              ? new Date(invoice.invoice_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
              : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

            await sendEmail(
              resolvedEmail,
              `⚠️ Payment Failed — Invoice ${invoice.invoice_number} — Action Required`,
              buildInvoiceIssuedEmail(
                resolvedName || resolvedEmail,
                invoice.invoice_number,
                amountFormatted,
                invoiceDate,
                dueDate,
                stripeInvoice.hosted_invoice_url ?? null,
                true,
                0
              )
            );
          }
        }

        console.log(`[stripe-invoice-payment-webhook] invoice.payment_failed: Invoice ${invoiceId} — Stripe ${stripeInvoice.id}`);
        break;
      }

      // ── Stripe Invoice created — send invoice issued email ────────────────
      case 'invoice.created': {
        const stripeInvoice = event.data.object as Stripe.Invoice;
        const invoiceId = stripeInvoice.metadata?.invoice_id;

        // Only send if this is linked to our internal invoice
        if (!invoiceId) break;

        // Only send for finalized invoices (not drafts)
        if (stripeInvoice.status !== 'open') break;

        const customerEmail = typeof stripeInvoice.customer_email === 'string' ? stripeInvoice.customer_email : '';
        const customerName = typeof stripeInvoice.customer_name === 'string' ? stripeInvoice.customer_name : '';

        const { data: invoice } = await supabase
          .from('client_invoices')
          .select('id, invoice_number, amount, currency, due_date, invoice_date, inquiry_id, user_id')
          .eq('id', invoiceId)
          .maybeSingle();

        if (invoice) {
          const { email: resolvedEmail, name: resolvedName } = await resolveClientDetails(
            supabase,
            invoice,
            customerEmail,
            customerName
          );

          if (resolvedEmail) {
            const amountFormatted = new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: (invoice.currency || 'usd').toUpperCase(),
            }).format(Number(invoice.amount));
            const dueDate = invoice.due_date
              ? new Date(invoice.due_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
              : 'Upon receipt';
            const invoiceDate = invoice.invoice_date
              ? new Date(invoice.invoice_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
              : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

            await sendEmail(
              resolvedEmail,
              `📄 New Invoice — ${invoice.invoice_number} — ${amountFormatted} Due`,
              buildInvoiceIssuedEmail(
                resolvedName || resolvedEmail,
                invoice.invoice_number,
                amountFormatted,
                invoiceDate,
                dueDate,
                stripeInvoice.hosted_invoice_url ?? null,
                false,
                0
              )
            );
          }
        }
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
