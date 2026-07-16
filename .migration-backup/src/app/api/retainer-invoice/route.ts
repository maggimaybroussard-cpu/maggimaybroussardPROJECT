import { NextRequest, NextResponse } from 'next/server';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://broussardlegalservices.com';

const brand = {
  bg: '#FAF7F2',
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

function buildInvoiceEmail(params: {
  recipientName: string;
  firmName: string;
  tierLabel: string;
  amount: number;
  hours: number;
  referenceCode: string;
  paymentIntentId: string;
  dateStr: string;
}): string {
  const { recipientName, firmName, tierLabel, amount, hours, referenceCode, paymentIntentId, dateStr } = params;
  const firstName = recipientName.split(' ')[0];

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Retainer Invoice — ${referenceCode}</title>
</head>
<body style="margin:0; padding:0; background-color:#EDE8E0; font-family: Georgia, 'Times New Roman', serif; -webkit-text-size-adjust:100%;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#EDE8E0; padding: 40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px; width:100%; background-color:${brand.bg}; border-radius:14px; overflow:hidden; border: 1px solid ${brand.border}; box-shadow: 0 4px 24px rgba(74,55,40,0.10);">

        <!-- Header -->
        <tr>
          <td style="background-color:${brand.primary}; padding:0;">
            <div style="height:4px; background: linear-gradient(to right, ${brand.accent}, #E8B87A, ${brand.accent});"></div>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="padding: 28px 36px 24px;">
              <tr>
                <td>
                  <table cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td style="border-right: 2px solid ${brand.accent}; padding-right: 14px; vertical-align: middle;">
                        <p style="margin:0; font-size:10px; color:${brand.accent}; letter-spacing:0.18em; text-transform:uppercase; font-family: Georgia, serif; line-height:1.4;">Paralegal</p>
                        <p style="margin:0; font-size:10px; color:${brand.accent}; letter-spacing:0.18em; text-transform:uppercase; font-family: Georgia, serif; line-height:1.4;">Services</p>
                      </td>
                      <td style="padding-left: 14px; vertical-align: middle;">
                        <h1 style="margin:0; font-size:24px; color:${brand.white}; font-family: Georgia, 'Times New Roman', serif; font-weight:normal; letter-spacing:0.01em; line-height:1.2;">Maggi May Broussard</h1>
                        <p style="margin:4px 0 0; font-size:12px; color:rgba(255,255,255,0.65); font-family: Georgia, serif; letter-spacing:0.06em;">Louisiana &amp; Nationwide</p>
                      </td>
                    </tr>
                  </table>
                </td>
                <td style="text-align:right; vertical-align:middle;">
                  <p style="margin:0; font-size:11px; color:${brand.accent}; letter-spacing:0.12em; text-transform:uppercase; font-family: Georgia, serif;">Invoice</p>
                  <p style="margin:4px 0 0; font-size:16px; color:${brand.white}; font-family: Georgia, serif; font-weight:bold;">${referenceCode}</p>
                </td>
              </tr>
            </table>
            <div style="height:1px; background: linear-gradient(to right, ${brand.accent}, rgba(200,150,90,0.2), transparent); margin: 0 36px;"></div>
            <div style="height:20px;"></div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding: 36px 36px 32px;">

            <!-- Status badge -->
            <span style="display:inline-block; background-color:${brand.green}; color:${brand.white}; font-size:10px; font-weight:bold; letter-spacing:0.12em; text-transform:uppercase; padding:4px 14px; border-radius:20px; margin-bottom:22px; font-family: Georgia, serif;">&#10003; Payment Confirmed</span>

            <!-- Greeting -->
            <h2 style="margin:0 0 16px; font-size:22px; color:${brand.foreground}; font-family: Georgia, 'Times New Roman', serif; font-weight:normal; border-bottom:1px solid ${brand.border}; padding-bottom:14px;">
              Your retainer is active, ${firstName}
            </h2>

            <p style="margin:0 0 16px; font-size:15px; color:${brand.foreground}; line-height:1.8; font-family: Georgia, serif;">
              Thank you for securing your retainer with Maggi May Broussard Legal Services. Your payment has been confirmed and your retainer is now active. Please retain this invoice for your records.
            </p>

            <!-- Invoice card -->
            <div style="background-color:${brand.white}; border:1px solid ${brand.border}; border-radius:12px; overflow:hidden; margin:0 0 28px;">
              <div style="background: linear-gradient(135deg, ${brand.primary} 0%, #3A2A1E 100%); padding:18px 24px;">
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                  <tr>
                    <td>
                      <p style="margin:0; font-size:11px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.14em; font-family: Georgia, serif;">Retainer Invoice</p>
                      <p style="margin:4px 0 0; font-size:18px; color:${brand.white}; font-family: Georgia, serif; font-weight:bold;">${referenceCode}</p>
                    </td>
                    <td style="text-align:right; vertical-align:top;">
                      <span style="display:inline-block; background-color:rgba(53,94,59,0.85); color:#AEEAB4; font-size:10px; font-weight:bold; letter-spacing:0.12em; text-transform:uppercase; padding:5px 14px; border-radius:20px; font-family: Georgia, serif;">&#10003; Paid</span>
                    </td>
                  </tr>
                </table>
              </div>
              <div style="padding:6px 24px 16px;">
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                  <tr>
                    <td style="padding:11px 0; border-bottom:1px solid rgba(217,208,197,0.5); vertical-align:top; width:45%;">
                      <p style="margin:0; font-size:12px; color:${brand.muted}; font-family: Georgia, serif; letter-spacing:0.04em; text-transform:uppercase;">Billed To</p>
                    </td>
                    <td style="padding:11px 0 11px 16px; border-bottom:1px solid rgba(217,208,197,0.5); vertical-align:top; text-align:right;">
                      <p style="margin:0; font-size:14px; color:${brand.foreground}; font-family: Georgia, serif; font-weight:bold;">${recipientName}</p>
                      ${firmName ? `<p style="margin:2px 0 0; font-size:12px; color:${brand.muted}; font-family: Georgia, serif;">${firmName}</p>` : ''}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:11px 0; border-bottom:1px solid rgba(217,208,197,0.5); vertical-align:top; width:45%;">
                      <p style="margin:0; font-size:12px; color:${brand.muted}; font-family: Georgia, serif; letter-spacing:0.04em; text-transform:uppercase;">Service</p>
                    </td>
                    <td style="padding:11px 0 11px 16px; border-bottom:1px solid rgba(217,208,197,0.5); vertical-align:top; text-align:right;">
                      <p style="margin:0; font-size:14px; color:${brand.foreground}; font-family: Georgia, serif; font-weight:bold;">${tierLabel}</p>
                      <p style="margin:2px 0 0; font-size:12px; color:${brand.muted}; font-family: Georgia, serif;">${hours} hrs/month included</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:11px 0; border-bottom:1px solid rgba(217,208,197,0.5); vertical-align:top; width:45%;">
                      <p style="margin:0; font-size:12px; color:${brand.muted}; font-family: Georgia, serif; letter-spacing:0.04em; text-transform:uppercase;">Invoice Date</p>
                    </td>
                    <td style="padding:11px 0 11px 16px; border-bottom:1px solid rgba(217,208,197,0.5); vertical-align:top; text-align:right;">
                      <p style="margin:0; font-size:14px; color:${brand.foreground}; font-family: Georgia, serif; font-weight:bold;">${dateStr}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:11px 0; border-bottom:1px solid rgba(217,208,197,0.5); vertical-align:top; width:45%;">
                      <p style="margin:0; font-size:12px; color:${brand.muted}; font-family: Georgia, serif; letter-spacing:0.04em; text-transform:uppercase;">Transaction ID</p>
                    </td>
                    <td style="padding:11px 0 11px 16px; border-bottom:1px solid rgba(217,208,197,0.5); vertical-align:top; text-align:right;">
                      <p style="margin:0; font-size:12px; color:${brand.muted}; font-family: Georgia, serif; font-weight:bold;">${paymentIntentId}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:14px 0 6px; border-top:2px solid ${brand.accent}; vertical-align:top; width:45%;">
                      <p style="margin:0; font-size:13px; color:${brand.foreground}; font-family: Georgia, serif; font-weight:bold; text-transform:uppercase; letter-spacing:0.06em;">Total Paid</p>
                    </td>
                    <td style="padding:14px 0 6px 16px; border-top:2px solid ${brand.accent}; vertical-align:top; text-align:right;">
                      <p style="margin:0; font-size:22px; color:${brand.green}; font-family: Georgia, serif; font-weight:bold;">$${amount.toLocaleString()} <span style="font-size:13px; color:${brand.muted};">USD</span></p>
                    </td>
                  </tr>
                </table>
              </div>
              <div style="background-color:${brand.secondary}; padding:12px 24px; border-top:1px solid ${brand.border};">
                <p style="margin:0; font-size:11px; color:${brand.muted}; font-family: Georgia, serif; line-height:1.6;">
                  &#128274;&nbsp; Payment processed securely via Stripe. Your card details are never stored on our servers.
                </p>
              </div>
            </div>

            <!-- Next steps -->
            <div style="background-color:${brand.accentLight}; border:1px solid rgba(200,150,90,0.35); border-radius:10px; padding:22px 24px; margin:0 0 28px;">
              <p style="margin:0 0 14px; font-size:11px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.12em; font-family: Georgia, serif;">What Happens Next</p>
              <table cellpadding="0" cellspacing="0" role="presentation" width="100%">
                ${[
                  ['01', 'Download and sign the retainer contract from the Retainer page.'],
                  ['02', 'Expect a welcome message within 1 business day to schedule your kickoff call.'],
                  ['03', 'Your retainer hours are available immediately upon receipt of signed agreement.'],
                ].map(([num, text]) => `
                <tr>
                  <td style="padding:6px 0; vertical-align:top; width:32px;">
                    <span style="display:inline-block; width:24px; height:24px; border-radius:50%; background-color:${brand.accent}; color:${brand.white}; font-size:10px; font-weight:bold; text-align:center; line-height:24px; font-family: Georgia, serif;">${num}</span>
                  </td>
                  <td style="padding:6px 0 6px 10px; vertical-align:top;">
                    <p style="margin:0; font-size:13px; color:${brand.foreground}; line-height:1.7; font-family: Georgia, serif;">${text}</p>
                  </td>
                </tr>`).join('')}
              </table>
            </div>

            <!-- CTA -->
            <table cellpadding="0" cellspacing="0" role="presentation" style="margin: 24px 0;">
              <tr>
                <td style="background-color:${brand.green}; border-radius:7px; box-shadow: 0 2px 8px rgba(53,94,59,0.30);">
                  <a href="${SITE_URL}/retainer-contract" style="display:inline-block; padding:14px 36px; color:${brand.white}; text-decoration:none; font-size:14px; font-family: Georgia, serif; letter-spacing:0.05em; font-weight:bold;">View Retainer Contract &rarr;</a>
                </td>
              </tr>
            </table>

            <!-- Signature -->
            <table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:28px; border-top:1px solid ${brand.border}; padding-top:20px; width:100%;">
              <tr>
                <td>
                  <p style="margin:0 0 4px; font-size:15px; color:${brand.foreground}; font-family: Georgia, serif;">Warm regards,</p>
                  <p style="margin:0 0 2px; font-size:16px; color:${brand.primary}; font-weight:bold; font-family: Georgia, serif;">Maggi May Broussard</p>
                  <p style="margin:0 0 6px; font-size:12px; color:${brand.muted}; font-family: Georgia, serif; letter-spacing:0.04em;">Licensed Paralegal · Louisiana &amp; Nationwide</p>
                  <a href="mailto:broussardlegalservices@gmail.com" style="color:${brand.accent}; font-size:13px; text-decoration:none; font-family: Georgia, serif;">broussardlegalservices@gmail.com</a>
                  &nbsp;<span style="color:${brand.border};">|</span>&nbsp;
                  <a href="${SITE_URL}" style="color:${brand.accent}; font-size:13px; text-decoration:none; font-family: Georgia, serif;">maggimay.com</a>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background-color:${brand.secondary}; padding: 20px 36px; border-top: 1px solid ${brand.border};">
            <p style="margin:0 0 6px; font-size:12px; color:${brand.primary}; font-weight:bold; font-family: Georgia, serif; letter-spacing:0.04em;">Maggi May Broussard Legal Services</p>
            <p style="margin:0; font-size:11px; color:${brand.muted}; line-height:1.7;">
              You received this because you completed a retainer payment at maggimay.com.
              <a href="${SITE_URL}" style="color:${brand.accent}; text-decoration:none;">Visit our site</a>
              &nbsp;·&nbsp;
              <a href="mailto:broussardlegalservices@gmail.com?subject=Unsubscribe" style="color:${brand.muted}; text-decoration:none;">Unsubscribe</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
  `.trim();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      recipientEmail,
      recipientName,
      firmName,
      tierLabel,
      amount,
      hours,
      paymentIntentId,
      referenceCode,
    } = body;

    if (!recipientEmail || !recipientName || !tierLabel || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!RESEND_API_KEY || RESEND_API_KEY === 'your-resend-api-key-here') {
      console.warn('RESEND_API_KEY not configured — skipping invoice email');
      return NextResponse.json({ success: true, skipped: true });
    }

    const dateStr = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const html = buildInvoiceEmail({
      recipientName,
      firmName: firmName ?? '',
      tierLabel,
      amount,
      hours,
      referenceCode,
      paymentIntentId,
      dateStr,
    });

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: [recipientEmail],
        subject: `Retainer Invoice ${referenceCode} — Maggi May Broussard Legal Services`,
        html,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error('Resend API error:', errData);
      return NextResponse.json({ error: 'Failed to send invoice email' }, { status: 500 });
    }

    const data = await response.json();
    return NextResponse.json({ success: true, id: data.id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('retainer-invoice route error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
