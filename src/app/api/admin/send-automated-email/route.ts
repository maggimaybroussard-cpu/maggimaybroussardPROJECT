import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const brand = {
  primary: '#4A3728',
  accent: '#C8965A',
  foreground: '#2C1F14',
  muted: '#7A6B5D',
  border: '#D9D0C5',
  secondary: '#EDE8E0',
  bg: '#FAF7F2',
  white: '#FFFFFF',
};

function buildEmailHtml(subject: string, bodyHtml: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0;padding:0;background-color:${brand.secondary};font-family:Georgia,'Times New Roman',serif;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:${brand.secondary};padding:40px 16px;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background-color:${brand.bg};border-radius:14px;overflow:hidden;border:1px solid ${brand.border};box-shadow:0 4px 24px rgba(74,55,40,0.10);">
            <!-- Header -->
            <tr>
              <td style="background-color:${brand.primary};padding:0;">
                <div style="height:4px;background:linear-gradient(to right,${brand.accent},#E8B87A,${brand.accent});"></div>
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="padding:28px 36px 24px;background-color:${brand.primary};">
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
              </td>
            </tr>
            <!-- Subject -->
            <tr>
              <td style="padding:32px 36px 0;">
                <h2 style="margin:0 0 20px;font-size:21px;color:${brand.foreground};font-family:Georgia,serif;font-weight:normal;border-bottom:1px solid ${brand.border};padding-bottom:14px;">${subject}</h2>
              </td>
            </tr>
            <!-- Body -->
            <tr>
              <td style="padding:0 36px 32px;">
                ${bodyHtml}
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="background-color:${brand.secondary};padding:20px 36px;border-top:1px solid ${brand.border};">
                <p style="margin:0;font-size:11px;color:${brand.muted};font-family:Georgia,serif;">Maggi May Broussard Legal Services &nbsp;·&nbsp; Louisiana &amp; Nationwide</p>
                <p style="margin:6px 0 0;font-size:11px;color:${brand.muted};font-family:Georgia,serif;">
                  <a href="https://broussardlegalservices.com" style="color:${brand.accent};text-decoration:none;">broussardlegalservices.com</a>
                </p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      type,
      itemId,
      recipientName,
      recipientEmail,
      recipientType,
      subject,
      bodyHtml,
    } = body;

    if (!type || !recipientEmail || !recipientName || !subject || !bodyHtml) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY || RESEND_API_KEY === 'your-resend-api-key-here') {
      return NextResponse.json(
        { error: 'RESEND_API_KEY is not configured. Please add your Resend API key to the environment variables.' },
        { status: 503 }
      );
    }

    const html = buildEmailHtml(subject, bodyHtml);

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: [recipientEmail],
        subject,
        html,
      }),
    });

    const resData = await res.json();

    if (!res.ok) {
      // Log failure
      try {
        const supabase = await createClient();
        await supabase.from('email_send_log').insert({
          recipient_name: recipientName,
          recipient_email: recipientEmail,
          recipient_type: recipientType || 'client',
          email_type: type,
          subject,
          status: 'failed',
          sent_at: new Date().toISOString(),
          error: resData?.message ?? `Resend returned ${res.status}`,
          item_id: itemId ?? null,
        });
      } catch (_) { /* non-critical */ }

      throw new Error(resData?.message ?? `Resend returned ${res.status}`);
    }

    // Log success
    try {
      const supabase = await createClient();
      await supabase.from('email_send_log').insert({
        recipient_name: recipientName,
        recipient_email: recipientEmail,
        recipient_type: recipientType || 'client',
        email_type: type,
        subject,
        status: 'sent',
        sent_at: new Date().toISOString(),
        error: null,
        item_id: itemId ?? null,
      });
    } catch (_) { /* non-critical */ }

    return NextResponse.json({ success: true, emailId: resData.id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to send email' },
      { status: 500 }
    );
  }
}
