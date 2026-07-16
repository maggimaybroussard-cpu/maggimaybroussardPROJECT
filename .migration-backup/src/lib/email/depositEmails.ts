/**
 * Sends consultation deposit invoice + payment receipt emails via Resend.
 * Called from the stripe-payment-intent webhook on payment_intent.succeeded
 * when payment_type is 'consultation_deposit' or 'retainer'.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://broussardlegalservices.com';
const FROM_EMAIL = 'maggimay@broussardlegalservices.com';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'maggimaybroussard@gmail.com';

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
  green: '#355E3B',
  greenLight: '#EAF2EB',
};

function formatCurrency(amount: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount);
}

function getPaymentLabel(paymentType: string): string {
  if (paymentType === 'consultation_deposit') return 'Consultation Deposit';
  if (paymentType === 'retainer') return 'Monthly Retainer Agreement';
  return 'Legal Services';
}

function getPaymentDescription(paymentType: string): string {
  if (paymentType === 'consultation_deposit')
    return 'This deposit secures your consultation slot and will be applied toward your first invoice upon engagement.';
  if (paymentType === 'retainer')
    return 'Your monthly retainer is active. This covers ongoing legal support, document drafting, and case management services.';
  return 'Thank you for your payment.';
}

interface SendDepositEmailsParams {
  resendApiKey: string;
  clientEmail: string;
  clientName: string;
  paymentType: string;
  amount: number;
  currency: string;
  invoiceNumber: string;
  paymentIntentId: string;
  paidDate: string;
}

export async function sendDepositInvoiceAndReceipt(
  params: SendDepositEmailsParams
): Promise<{ invoiceSent: boolean; receiptSent: boolean; errors: string[] }> {
  const {
    resendApiKey,
    clientEmail,
    clientName,
    paymentType,
    amount,
    currency,
    invoiceNumber,
    paymentIntentId,
    paidDate,
  } = params;

  const errors: string[] = [];
  const label = getPaymentLabel(paymentType);
  const description = getPaymentDescription(paymentType);
  const amountFormatted = formatCurrency(amount, currency);
  const firstName = clientName.split(' ')[0] ?? clientName;

  // ── Invoice Email ──────────────────────────────────────────────────────────
  const invoiceHtml = buildInvoiceEmail({
    clientName,
    firstName,
    clientEmail,
    label,
    description,
    amountFormatted,
    amount,
    currency,
    invoiceNumber,
    paidDate,
    paymentIntentId,
  });

  let invoiceSent = false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [clientEmail],
        bcc: [ADMIN_EMAIL],
        subject: `Invoice ${invoiceNumber} — ${label} · ${amountFormatted}`,
        html: invoiceHtml,
      }),
    });
    if (res.ok) {
      invoiceSent = true;
    } else {
      const err = await res.json().catch(() => ({}));
      errors.push(`Invoice email failed: ${(err as { message?: string }).message ?? res.status}`);
    }
  } catch (e) {
    errors.push(`Invoice email error: ${e instanceof Error ? e.message : String(e)}`);
  }

  // ── Receipt Email ──────────────────────────────────────────────────────────
  const receiptHtml = buildReceiptEmail({
    clientName,
    firstName,
    label,
    description,
    amountFormatted,
    amount,
    currency,
    invoiceNumber,
    paidDate,
    paymentIntentId,
  });

  let receiptSent = false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [clientEmail],
        subject: `Payment Receipt — ${label} · ${amountFormatted}`,
        html: receiptHtml,
      }),
    });
    if (res.ok) {
      receiptSent = true;
    } else {
      const err = await res.json().catch(() => ({}));
      errors.push(`Receipt email failed: ${(err as { message?: string }).message ?? res.status}`);
    }
  } catch (e) {
    errors.push(`Receipt email error: ${e instanceof Error ? e.message : String(e)}`);
  }

  return { invoiceSent, receiptSent, errors };
}

// ─── Invoice Email Template ────────────────────────────────────────────────────
function buildInvoiceEmail(p: {
  clientName: string;
  firstName: string;
  clientEmail: string;
  label: string;
  description: string;
  amountFormatted: string;
  amount: number;
  currency: string;
  invoiceNumber: string;
  paidDate: string;
  paymentIntentId: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${p.invoiceNumber} — Maggi May Broussard</title>
</head>
<body style="margin:0;padding:0;background-color:#EDE8E0;font-family:Georgia,'Times New Roman',serif;-webkit-text-size-adjust:100%;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#EDE8E0;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background-color:${brand.bg};border-radius:14px;overflow:hidden;border:1px solid ${brand.border};box-shadow:0 4px 24px rgba(74,55,40,0.10);">

        <!-- HEADER -->
        <tr>
          <td style="background-color:${brand.primary};padding:0;">
            <div style="height:4px;background:linear-gradient(to right,${brand.accent},#E8B87A,${brand.accent});"></div>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="padding:28px 36px 24px;">
              <tr>
                <td>
                  <table cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td style="border-right:2px solid ${brand.accent};padding-right:14px;vertical-align:middle;">
                        <p style="margin:0;font-size:10px;color:${brand.accent};letter-spacing:0.18em;text-transform:uppercase;font-family:Georgia,serif;line-height:1.4;">Paralegal</p>
                        <p style="margin:0;font-size:10px;color:${brand.accent};letter-spacing:0.18em;text-transform:uppercase;font-family:Georgia,serif;line-height:1.4;">Services</p>
                      </td>
                      <td style="padding-left:14px;vertical-align:middle;">
                        <h1 style="margin:0;font-size:24px;color:${brand.white};font-family:Georgia,'Times New Roman',serif;font-weight:normal;letter-spacing:0.01em;line-height:1.2;">Maggi May Broussard</h1>
                        <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.65);font-family:Georgia,serif;letter-spacing:0.06em;">Louisiana &amp; Nationwide</p>
                      </td>
                    </tr>
                  </table>
                </td>
                <td align="right" style="vertical-align:middle;">
                  <p style="margin:0;font-size:28px;font-weight:bold;color:${brand.white};font-family:Georgia,serif;letter-spacing:0.04em;">INVOICE</p>
                  <p style="margin:4px 0 0;font-size:11px;color:rgba(255,255,255,0.6);font-family:Georgia,serif;">${p.invoiceNumber}</p>
                </td>
              </tr>
            </table>
            <div style="height:1px;background:linear-gradient(to right,${brand.accent},rgba(200,150,90,0.2),transparent);margin:0 36px;"></div>
            <div style="height:20px;"></div>
          </td>
        </tr>

        <!-- INVOICE META -->
        <tr>
          <td style="padding:28px 36px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="width:50%;vertical-align:top;">
                  <p style="margin:0 0 4px;font-size:9px;font-weight:bold;color:${brand.accent};letter-spacing:0.14em;text-transform:uppercase;font-family:Georgia,serif;">Bill To</p>
                  <p style="margin:0 0 2px;font-size:14px;font-weight:bold;color:${brand.foreground};font-family:Georgia,serif;">${p.clientName}</p>
                  <p style="margin:0;font-size:12px;color:${brand.muted};font-family:Georgia,serif;">${p.clientEmail}</p>
                </td>
                <td style="width:50%;vertical-align:top;text-align:right;">
                  <table cellpadding="0" cellspacing="0" role="presentation" style="margin-left:auto;">
                    <tr>
                      <td style="padding:3px 0;font-size:11px;color:${brand.muted};font-family:Georgia,serif;padding-right:12px;">Invoice No:</td>
                      <td style="padding:3px 0;font-size:11px;font-weight:bold;color:${brand.foreground};font-family:Georgia,serif;">${p.invoiceNumber}</td>
                    </tr>
                    <tr>
                      <td style="padding:3px 0;font-size:11px;color:${brand.muted};font-family:Georgia,serif;padding-right:12px;">Date:</td>
                      <td style="padding:3px 0;font-size:11px;color:${brand.foreground};font-family:Georgia,serif;">${p.paidDate}</td>
                    </tr>
                    <tr>
                      <td style="padding:3px 0;font-size:11px;color:${brand.muted};font-family:Georgia,serif;padding-right:12px;">Status:</td>
                      <td style="padding:3px 0;font-size:11px;font-weight:bold;color:#2d6a4f;font-family:Georgia,serif;">PAID</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- LINE ITEMS TABLE -->
        <tr>
          <td style="padding:24px 36px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;">
              <thead>
                <tr style="background-color:#F0EBE3;">
                  <th style="padding:10px 12px;text-align:left;font-size:9px;font-weight:bold;color:${brand.accent};letter-spacing:0.14em;text-transform:uppercase;font-family:Georgia,serif;">Description</th>
                  <th style="padding:10px 12px;text-align:center;font-size:9px;font-weight:bold;color:${brand.accent};letter-spacing:0.14em;text-transform:uppercase;font-family:Georgia,serif;">Qty</th>
                  <th style="padding:10px 12px;text-align:right;font-size:9px;font-weight:bold;color:${brand.accent};letter-spacing:0.14em;text-transform:uppercase;font-family:Georgia,serif;">Unit Price</th>
                  <th style="padding:10px 12px;text-align:right;font-size:9px;font-weight:bold;color:${brand.accent};letter-spacing:0.14em;text-transform:uppercase;font-family:Georgia,serif;">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="padding:14px 12px;font-size:13px;color:${brand.foreground};font-family:Georgia,serif;border-bottom:1px solid ${brand.border};">${p.label}</td>
                  <td style="padding:14px 12px;text-align:center;font-size:13px;color:${brand.foreground};font-family:Georgia,serif;border-bottom:1px solid ${brand.border};">1</td>
                  <td style="padding:14px 12px;text-align:right;font-size:13px;color:${brand.foreground};font-family:Georgia,serif;border-bottom:1px solid ${brand.border};">${p.amountFormatted}</td>
                  <td style="padding:14px 12px;text-align:right;font-size:13px;font-weight:bold;color:${brand.foreground};font-family:Georgia,serif;border-bottom:1px solid ${brand.border};">${p.amountFormatted}</td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>

        <!-- TOTAL -->
        <tr>
          <td style="padding:0 36px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td></td>
                <td style="width:220px;">
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td style="padding:8px 12px;font-size:12px;color:${brand.muted};font-family:Georgia,serif;">Subtotal</td>
                      <td style="padding:8px 12px;text-align:right;font-size:12px;color:${brand.foreground};font-family:Georgia,serif;">${p.amountFormatted}</td>
                    </tr>
                    <tr>
                      <td style="padding:8px 12px;font-size:12px;color:${brand.muted};font-family:Georgia,serif;">Tax (0%)</td>
                      <td style="padding:8px 12px;text-align:right;font-size:12px;color:${brand.foreground};font-family:Georgia,serif;">$0.00</td>
                    </tr>
                    <tr style="background-color:${brand.accent};">
                      <td style="padding:12px;font-size:13px;font-weight:bold;color:${brand.white};font-family:Georgia,serif;">Total Due</td>
                      <td style="padding:12px;text-align:right;font-size:16px;font-weight:bold;color:${brand.white};font-family:Georgia,serif;">${p.amountFormatted}</td>
                    </tr>
                    <tr style="background-color:#EAF2EB;">
                      <td style="padding:10px 12px;font-size:12px;font-weight:bold;color:#2d6a4f;font-family:Georgia,serif;">&#10003; Paid</td>
                      <td style="padding:10px 12px;text-align:right;font-size:12px;font-weight:bold;color:#2d6a4f;font-family:Georgia,serif;">${p.amountFormatted}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- NOTES -->
        <tr>
          <td style="padding:0 36px 28px;">
            <div style="background-color:${brand.accentLight};border-left:3px solid ${brand.accent};padding:16px 20px;border-radius:0 8px 8px 0;">
              <p style="margin:0 0 6px;font-size:10px;font-weight:bold;color:${brand.accent};text-transform:uppercase;letter-spacing:0.1em;font-family:Georgia,serif;">Note</p>
              <p style="margin:0;font-size:13px;color:${brand.foreground};line-height:1.7;font-family:Georgia,serif;">${p.description}</p>
            </div>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:0 36px 32px;text-align:center;">
            <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;">
              <tr>
                <td style="background-color:${brand.green};border-radius:7px;box-shadow:0 2px 8px rgba(53,94,59,0.25);">
                  <a href="${SITE_URL}/portal/dashboard" style="display:inline-block;padding:13px 28px;color:${brand.white};text-decoration:none;font-size:13px;font-family:Georgia,serif;letter-spacing:0.05em;font-weight:bold;">View Client Portal &rarr;</a>
                </td>
              </tr>
            </table>
            <p style="margin:12px 0 0;font-size:11px;color:${brand.muted};font-family:Georgia,serif;">Reference: <span style="font-family:monospace;">${p.paymentIntentId.slice(-12).toUpperCase()}</span></p>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="background-color:${brand.secondary};padding:20px 36px;border-top:1px solid ${brand.border};">
            <p style="margin:0 0 4px;font-size:12px;font-weight:bold;color:${brand.primary};font-family:Georgia,serif;letter-spacing:0.04em;">Maggi May Broussard Legal Services</p>
            <p style="margin:0;font-size:11px;color:${brand.muted};line-height:1.7;">Questions? Reply to this email or contact <a href="mailto:maggimaybroussard@gmail.com" style="color:${brand.accent};text-decoration:none;">maggimaybroussard@gmail.com</a></p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Receipt Email Template ────────────────────────────────────────────────────
function buildReceiptEmail(p: {
  clientName: string;
  firstName: string;
  label: string;
  description: string;
  amountFormatted: string;
  amount: number;
  currency: string;
  invoiceNumber: string;
  paidDate: string;
  paymentIntentId: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Receipt — Maggi May Broussard</title>
</head>
<body style="margin:0;padding:0;background-color:#EDE8E0;font-family:Georgia,'Times New Roman',serif;-webkit-text-size-adjust:100%;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#EDE8E0;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background-color:${brand.bg};border-radius:14px;overflow:hidden;border:1px solid ${brand.border};box-shadow:0 4px 24px rgba(74,55,40,0.10);">

        <!-- HEADER -->
        <tr>
          <td style="background-color:${brand.primary};padding:0;">
            <div style="height:4px;background:linear-gradient(to right,${brand.accent},#E8B87A,${brand.accent});"></div>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="padding:28px 36px 24px;">
              <tr>
                <td>
                  <table cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td style="border-right:2px solid ${brand.accent};padding-right:14px;vertical-align:middle;">
                        <p style="margin:0;font-size:10px;color:${brand.accent};letter-spacing:0.18em;text-transform:uppercase;font-family:Georgia,serif;line-height:1.4;">Paralegal</p>
                        <p style="margin:0;font-size:10px;color:${brand.accent};letter-spacing:0.18em;text-transform:uppercase;font-family:Georgia,serif;line-height:1.4;">Services</p>
                      </td>
                      <td style="padding-left:14px;vertical-align:middle;">
                        <h1 style="margin:0;font-size:24px;color:${brand.white};font-family:Georgia,'Times New Roman',serif;font-weight:normal;letter-spacing:0.01em;line-height:1.2;">Maggi May Broussard</h1>
                        <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.65);font-family:Georgia,serif;letter-spacing:0.06em;">Louisiana &amp; Nationwide</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <div style="height:1px;background:linear-gradient(to right,${brand.accent},rgba(200,150,90,0.2),transparent);margin:0 36px;"></div>
            <div style="height:20px;"></div>
          </td>
        </tr>

        <!-- SUCCESS BADGE + TITLE -->
        <tr>
          <td style="padding:32px 36px 0;text-align:center;">
            <div style="width:64px;height:64px;border-radius:50%;background-color:#EAF2EB;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;">
              <span style="font-size:28px;">&#10003;</span>
            </div>
            <span style="display:inline-block;background-color:${brand.accent};color:${brand.white};font-size:10px;font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;padding:4px 14px;border-radius:20px;margin-bottom:16px;font-family:Georgia,serif;">Payment Confirmed</span>
            <h2 style="margin:0 0 8px;font-size:24px;color:${brand.foreground};font-family:Georgia,'Times New Roman',serif;font-weight:normal;">Receipt for ${p.label}</h2>
            <p style="margin:0 0 24px;font-size:15px;color:${brand.muted};font-family:Georgia,serif;">${p.paidDate}</p>
          </td>
        </tr>

        <!-- RECEIPT DETAILS CARD -->
        <tr>
          <td style="padding:0 36px 24px;">
            <div style="background-color:${brand.bgCard};border:1px solid ${brand.border};border-radius:10px;overflow:hidden;">
              <div style="background-color:${brand.primary};padding:12px 22px;">
                <p style="margin:0;font-size:11px;color:${brand.accent};font-weight:bold;text-transform:uppercase;letter-spacing:0.12em;font-family:Georgia,serif;">&#128197; Payment Details</p>
              </div>
              <div style="padding:20px 22px;">
                <table style="width:100%;border-collapse:collapse;font-family:Georgia,serif;">
                  <tr>
                    <td style="padding:8px 0;color:${brand.muted};font-size:13px;width:45%;border-bottom:1px solid rgba(217,208,197,0.5);">Amount Paid</td>
                    <td style="padding:8px 0;font-size:18px;font-weight:bold;color:#2d6a4f;border-bottom:1px solid rgba(217,208,197,0.5);">${p.amountFormatted}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;color:${brand.muted};font-size:13px;border-bottom:1px solid rgba(217,208,197,0.5);">Service</td>
                    <td style="padding:8px 0;font-size:14px;font-weight:bold;color:${brand.foreground};border-bottom:1px solid rgba(217,208,197,0.5);">${p.label}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;color:${brand.muted};font-size:13px;border-bottom:1px solid rgba(217,208,197,0.5);">Invoice No.</td>
                    <td style="padding:8px 0;font-size:13px;color:${brand.foreground};border-bottom:1px solid rgba(217,208,197,0.5);">${p.invoiceNumber}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;color:${brand.muted};font-size:13px;border-bottom:1px solid rgba(217,208,197,0.5);">Date</td>
                    <td style="padding:8px 0;font-size:13px;color:${brand.foreground};border-bottom:1px solid rgba(217,208,197,0.5);">${p.paidDate}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;color:${brand.muted};font-size:13px;">Reference</td>
                    <td style="padding:8px 0;font-size:12px;color:${brand.muted};font-family:monospace;">${p.paymentIntentId.slice(-12).toUpperCase()}</td>
                  </tr>
                </table>
              </div>
            </div>
          </td>
        </tr>

        <!-- NOTE -->
        <tr>
          <td style="padding:0 36px 28px;">
            <div style="background-color:${brand.greenLight};border:1px solid rgba(53,94,59,0.20);border-radius:10px;padding:18px 22px;">
              <p style="margin:0 0 8px;font-size:11px;font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;color:${brand.green};font-family:Georgia,serif;">What happens next</p>
              <p style="margin:0;font-size:14px;color:${brand.foreground};line-height:1.7;font-family:Georgia,serif;">${p.description}</p>
            </div>
          </td>
        </tr>

        <!-- BODY -->
        <tr>
          <td style="padding:0 36px 32px;">
            <p style="margin:0 0 16px;font-size:15px;color:${brand.foreground};line-height:1.8;font-family:Georgia,serif;">Dear ${p.firstName},</p>
            <p style="margin:0 0 20px;font-size:15px;color:${brand.foreground};line-height:1.8;font-family:Georgia,serif;">
              Thank you for your payment. Your invoice has been sent separately for your records. Please keep this receipt for your files.
            </p>
            <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 28px;">
              <tr>
                <td style="background-color:${brand.accent};border-radius:7px;box-shadow:0 2px 8px rgba(200,150,90,0.25);">
                  <a href="${SITE_URL}/portal/dashboard" style="display:inline-block;padding:14px 36px;color:${brand.white};text-decoration:none;font-size:14px;font-family:Georgia,serif;letter-spacing:0.05em;font-weight:bold;">Access Client Portal &rarr;</a>
                </td>
              </tr>
            </table>
            <table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:28px;border-top:1px solid ${brand.border};padding-top:20px;width:100%;">
              <tr>
                <td>
                  <p style="margin:0 0 4px;font-size:15px;color:${brand.foreground};font-family:Georgia,serif;">Warm regards,</p>
                  <p style="margin:0 0 2px;font-size:16px;color:${brand.primary};font-weight:bold;font-family:Georgia,serif;">Maggi May Broussard</p>
                  <p style="margin:0 0 6px;font-size:12px;color:${brand.muted};font-family:Georgia,serif;letter-spacing:0.04em;">Licensed Paralegal &middot; Louisiana &amp; Nationwide</p>
                  <a href="mailto:maggimaybroussard@gmail.com" style="color:${brand.accent};font-size:13px;text-decoration:none;font-family:Georgia,serif;">maggimaybroussard@gmail.com</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="background-color:${brand.secondary};padding:20px 36px;border-top:1px solid ${brand.border};">
            <p style="margin:0 0 6px;font-size:12px;font-weight:bold;color:${brand.primary};font-family:Georgia,serif;letter-spacing:0.04em;">Maggi May Broussard Legal Services</p>
            <p style="margin:0;font-size:11px;color:${brand.muted};line-height:1.7;">This is an automated payment receipt. Please do not reply to this email. For questions, contact <a href="mailto:maggimaybroussard@gmail.com" style="color:${brand.accent};text-decoration:none;">maggimaybroussard@gmail.com</a></p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
