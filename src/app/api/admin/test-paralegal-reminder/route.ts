import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SENDER_EMAIL = 'maggimay@broussardlegalservices.com';
const SENDER_NAME = 'Maggi May Broussard';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify admin session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!RESEND_API_KEY) {
      return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 503 });
    }

    // Fetch all active paralegals
    const { data: paralegals, error: paralegalError } = await supabase
      .from('paralegal_availability')
      .select('paralegal_name, paralegal_email')
      .not('paralegal_email', 'is', null);

    if (paralegalError) {
      return NextResponse.json({ error: paralegalError.message }, { status: 500 });
    }

    if (!paralegals || paralegals.length === 0) {
      // Fall back to admin email if no paralegals found
      const adminEmail = user.email;
      if (!adminEmail) {
        return NextResponse.json({ error: 'No paralegals found and no admin email available' }, { status: 404 });
      }

      const html = buildTestReminderHtml('Admin', adminEmail, true);
      const res = await sendTestEmail(adminEmail, html);
      return NextResponse.json({
        success: true,
        message: 'No paralegals found — test reminder sent to admin email instead',
        sent: [{ email: adminEmail, status: res.ok ? 'delivered' : 'failed' }],
        sender: `${SENDER_NAME} <${SENDER_EMAIL}>`,
      });
    }

    // Deduplicate by email
    const uniqueParalegals = Array.from(
      new Map(paralegals.map((p) => [p.paralegal_email, p])).values()
    );

    const results: { name: string; email: string; status: string; error?: string }[] = [];

    for (const paralegal of uniqueParalegals) {
      const html = buildTestReminderHtml(paralegal.paralegal_name || 'Paralegal', paralegal.paralegal_email);
      const res = await sendTestEmail(paralegal.paralegal_email, html);

      if (res.ok) {
        results.push({ name: paralegal.paralegal_name || 'Paralegal', email: paralegal.paralegal_email, status: 'delivered' });
      } else {
        const errBody = await res.json().catch(() => ({}));
        results.push({
          name: paralegal.paralegal_name || 'Paralegal',
          email: paralegal.paralegal_email,
          status: 'failed',
          error: errBody?.message || `HTTP ${res.status}`,
        });
      }
    }

    const delivered = results.filter((r) => r.status === 'delivered').length;
    const failed = results.filter((r) => r.status === 'failed').length;

    return NextResponse.json({
      success: true,
      message: `Test reminder sent to ${delivered} paralegal(s)${failed > 0 ? `, ${failed} failed` : ''}`,
      sender: `${SENDER_NAME} <${SENDER_EMAIL}>`,
      results,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unexpected error' }, { status: 500 });
  }
}

async function sendTestEmail(toEmail: string, html: string): Promise<Response> {
  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: `${SENDER_NAME} <${SENDER_EMAIL}>`,
      to: [toEmail],
      subject: '✅ Test Reminder — Broussard Legal Services (Sender Verification)',
      html,
    }),
  });
}

function buildTestReminderHtml(name: string, email: string, isAdmin = false): string {
  const now = new Date().toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    dateStyle: 'full',
    timeStyle: 'short',
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Test Reminder</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:#1a1a2e;padding:28px 40px;">
              <p style="margin:0;color:#c9a84c;font-size:13px;letter-spacing:2px;text-transform:uppercase;font-weight:600;">Broussard Legal Services</p>
              <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:700;">✅ Test Reminder Delivery</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 16px;color:#374151;font-size:15px;">Hi <strong>${name}</strong>,</p>
              <p style="margin:0 0 16px;color:#374151;font-size:15px;">
                This is a <strong>test reminder email</strong> sent from the Broussard Legal Services admin panel to confirm that the verified sender domain is working correctly.
              </p>
              ${isAdmin ? `<p style="margin:0 0 16px;color:#6b7280;font-size:14px;font-style:italic;">Note: No paralegal records were found — this test was sent to the admin email instead.</p>` : ''}
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;margin:24px 0;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 8px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Delivery Details</p>
                    <p style="margin:0 0 6px;color:#111827;font-size:14px;"><strong>Sent to:</strong> ${email}</p>
                    <p style="margin:0 0 6px;color:#111827;font-size:14px;"><strong>Sent from:</strong> ${SENDER_NAME} &lt;${SENDER_EMAIL}&gt;</p>
                    <p style="margin:0;color:#111827;font-size:14px;"><strong>Timestamp:</strong> ${now} (CT)</p>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 16px;color:#374151;font-size:15px;">
                If you received this email, the <strong>maggimay@broussardlegalservices.com</strong> sender domain is verified and working. Deadline reminders, appointment alerts, and case notifications will now deliver from this address.
              </p>
              <p style="margin:0;color:#6b7280;font-size:13px;">
                You can safely ignore this message — no action is required.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;">
              <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
                Broussard Legal Services &bull; <a href="https://broussardlegalservices.com" style="color:#c9a84c;text-decoration:none;">broussardlegalservices.com</a>
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
}
