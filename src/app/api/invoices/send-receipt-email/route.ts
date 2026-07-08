import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return NextResponse.json({ error: 'Resend is not configured' }, { status: 503 });
    }

    const resend = new Resend(resendApiKey);
    const body = await req.json();
    const { invoice_id, session_id, invoice_number, amount } = body;

    if (!invoice_id && !session_id) {
      return NextResponse.json({ error: 'Missing invoice_id or session_id' }, { status: 400 });
    }

    const supabase = await createClient();

    // Fetch invoice details
    const { data: invoice, error: invoiceError } = await supabase
      .from('client_invoices')
      .select('*')
      .eq('id', invoice_id)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Get client info
    let clientEmail = '';
    let clientName = 'Valued Client';

    if (invoice.inquiry_id) {
      const { data: inquiry } = await supabase
        .from('contact_inquiries')
        .select('name, email')
        .eq('id', invoice.inquiry_id)
        .single();
      if (inquiry) {
        clientEmail = inquiry.email ?? '';
        clientName = inquiry.name ?? 'Valued Client';
      }
    }

    if (!clientEmail) {
      return NextResponse.json({ error: 'No client email found for this invoice' }, { status: 400 });
    }

    const paidAmount = amount ?? invoice.amount;
    const refCode = session_id
      ? `RCP-${session_id.slice(-8).toUpperCase()}`
      : `RCP-${invoice_id.slice(-8).toUpperCase()}`;

    const paymentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const fmt = (n: number) =>
      new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);

    // Build line items HTML
    const lineItems = Array.isArray(invoice.line_items) ? invoice.line_items : [];
    const lineItemsHtml =
      lineItems.length > 0
        ? lineItems
            .map(
              (item: { description: string; quantity: number; unit_price: number; total: number }) => `
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px;color:#333;">${item.description}</td>
            <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px;color:#666;text-align:center;">${item.quantity}</td>
            <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px;color:#666;text-align:right;">${fmt(item.unit_price)}</td>
            <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px;font-weight:600;color:#1a1a1a;text-align:right;">${fmt(item.total)}</td>
          </tr>`
            )
            .join('')
        : `<tr><td colspan="4" style="padding:10px 0;font-size:14px;color:#666;">Legal services — see invoice for details.</td></tr>`;

    const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Payment Receipt — ${invoice_number ?? invoice.invoice_number}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background:#355E3B;padding:32px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0;font-size:20px;font-weight:bold;color:#ffffff;letter-spacing:-0.5px;">Maggi May Broussard</p>
                    <p style="margin:4px 0 0;font-size:11px;color:rgba(255,255,255,0.7);letter-spacing:2px;text-transform:uppercase;">Contract Legal Services</p>
                  </td>
                  <td align="right">
                    <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.7);letter-spacing:2px;text-transform:uppercase;">Payment Receipt</p>
                    <p style="margin:4px 0 0;font-size:16px;font-weight:bold;color:#ffffff;font-family:monospace;">${refCode}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Success Badge -->
          <tr>
            <td style="padding:32px 40px 0;text-align:center;">
              <div style="display:inline-block;background:#e8f5e9;border-radius:50%;width:64px;height:64px;line-height:64px;text-align:center;margin-bottom:16px;">
                <span style="font-size:28px;">✓</span>
              </div>
              <h1 style="margin:0 0 8px;font-size:24px;color:#1a1a1a;">Payment Confirmed</h1>
              <p style="margin:0;font-size:15px;color:#666;line-height:1.6;">
                Hi ${clientName.split(' ')[0]}, your payment has been processed successfully.
              </p>
            </td>
          </tr>

          <!-- Amount -->
          <tr>
            <td style="padding:24px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:10px;border:1px solid #e5e7eb;">
                <tr>
                  <td style="padding:20px 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <p style="margin:0;font-size:11px;color:#888;letter-spacing:2px;text-transform:uppercase;">Amount Paid</p>
                          <p style="margin:6px 0 0;font-size:32px;font-weight:bold;color:#355E3B;">${fmt(paidAmount)}</p>
                        </td>
                        <td align="right">
                          <span style="display:inline-block;background:#e8f5e9;color:#355E3B;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;">✓ Paid</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Details -->
          <tr>
            <td style="padding:0 40px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:13px;color:#888;">Invoice Number</td>
                        <td style="font-size:13px;font-weight:600;color:#1a1a1a;text-align:right;">${invoice_number ?? invoice.invoice_number}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:13px;color:#888;">Payment Date</td>
                        <td style="font-size:13px;font-weight:600;color:#1a1a1a;text-align:right;">${paymentDate}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:13px;color:#888;">Billed To</td>
                        <td style="font-size:13px;font-weight:600;color:#1a1a1a;text-align:right;">${clientName}<br/><span style="font-weight:400;color:#666;">${clientEmail}</span></td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Line Items -->
          ${lineItems.length > 0 ? `
          <tr>
            <td style="padding:0 40px 24px;">
              <p style="margin:0 0 12px;font-size:11px;color:#888;letter-spacing:2px;text-transform:uppercase;font-weight:600;">Services</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <thead>
                  <tr style="border-bottom:2px solid #e5e7eb;">
                    <th style="padding:8px 0;font-size:11px;color:#888;text-align:left;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Description</th>
                    <th style="padding:8px 0;font-size:11px;color:#888;text-align:center;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Qty</th>
                    <th style="padding:8px 0;font-size:11px;color:#888;text-align:right;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Unit</th>
                    <th style="padding:8px 0;font-size:11px;color:#888;text-align:right;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${lineItemsHtml}
                </tbody>
              </table>
            </td>
          </tr>
          ` : ''}

          <!-- CTA -->
          <tr>
            <td style="padding:0 40px 32px;text-align:center;">
              <a href="${process.env.NEXT_PUBLIC_SITE_URL}/client/invoices/${invoice_id}" 
                 style="display:inline-block;background:#355E3B;color:#ffffff;padding:14px 32px;border-radius:10px;font-size:14px;font-weight:600;text-decoration:none;letter-spacing:0.3px;">
                View Invoice Detail
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0;font-size:12px;color:#999;line-height:1.8;">
                Maggi May Broussard · Contract Legal Services · Nationwide Remote Paralegal Support<br/>
                <a href="${process.env.NEXT_PUBLIC_SITE_URL}" style="color:#355E3B;text-decoration:none;">broussardlegalservices.com</a>
              </p>
              <p style="margin:12px 0 0;font-size:11px;color:#bbb;">
                This receipt confirms your payment was received and processed securely via Stripe.<br/>
                Please retain this email for your records.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: 'Broussard Legal Services <noreply@broussardlegalservices.com>',
      to: [clientEmail],
      subject: `Payment Receipt — Invoice ${invoice_number ?? invoice.invoice_number} · ${fmt(paidAmount)}`,
      html: htmlBody,
    });

    if (emailError) {
      console.error('[send-receipt-email] Resend error:', emailError);
      return NextResponse.json({ error: 'Failed to send receipt email', details: emailError }, { status: 500 });
    }

    // Log the email send
    await supabase.from('invoice_email_logs').insert({
      invoice_id: invoice_id,
      email_type: 'payment_receipt',
      recipient_email: clientEmail,
      status: 'sent',
      resend_id: emailData?.id ?? null,
    }).then(() => {}).catch(() => {});

    return NextResponse.json({ success: true, email_id: emailData?.id });
  } catch (err: unknown) {
    console.error('[send-receipt-email] Error:', err);
    const message = err instanceof Error ? err.message : 'Failed to send receipt email';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
