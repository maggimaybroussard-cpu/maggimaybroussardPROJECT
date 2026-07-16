import { NextRequest, NextResponse } from 'next/server';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://broussardlegalservices.com';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';

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
};

interface PrepDoc {
  fileName: string;
  publicUrl: string | null;
  description: string | null;
}

function buildPrepDocsEmail(clientName: string, documents: PrepDoc[]): string {
  const firstName = clientName.split(' ')[0];
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:${brand.secondary};font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:${brand.secondary};padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background-color:${brand.bg};border-radius:14px;overflow:hidden;border:1px solid ${brand.border};box-shadow:0 4px 24px rgba(74,55,40,0.10);">
        <tr><td style="height:4px;background:linear-gradient(to right,${brand.accent},#E8B87A,${brand.accent});"></td></tr>
        <tr>
          <td style="background-color:${brand.primary};padding:28px 36px 24px;">
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
        <tr>
          <td style="padding:32px 36px 0;">
            <div style="display:inline-block;padding:8px 18px;background-color:rgba(200,150,90,0.12);border-radius:20px;margin-bottom:20px;">
              <span style="font-size:13px;color:${brand.accent};font-family:Georgia,serif;font-weight:bold;letter-spacing:0.04em;">&#128196; Consultation Prep Materials</span>
            </div>
            <h2 style="margin:0 0 8px;font-size:22px;color:${brand.foreground};font-family:Georgia,serif;font-weight:normal;">Your prep resources are ready, ${firstName}.</h2>
            <p style="margin:0 0 24px;font-size:15px;color:${brand.muted};font-family:Georgia,serif;line-height:1.7;">Please review the following documents before your upcoming consultation. They will help us make the most of our time together.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 36px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:${brand.accentLight};border-radius:10px;border:1px solid ${brand.border};overflow:hidden;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 16px;font-size:11px;color:${brand.muted};font-family:Georgia,serif;text-transform:uppercase;letter-spacing:0.1em;font-weight:bold;">Attached Resources</p>
                  ${documents.map((doc, i) => `
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:${i < documents.length - 1 ? '12px' : '0'};padding-bottom:${i < documents.length - 1 ? '12px' : '0'};border-bottom:${i < documents.length - 1 ? `1px solid ${brand.border}` : 'none'};">
                    <tr>
                      <td style="vertical-align:top;padding-right:12px;width:24px;">
                        <span style="font-size:16px;">&#128196;</span>
                      </td>
                      <td>
                        <p style="margin:0 0 2px;font-size:14px;color:${brand.foreground};font-family:Georgia,serif;font-weight:bold;">${doc.fileName}</p>
                        ${doc.description ? `<p style="margin:0 0 6px;font-size:12px;color:${brand.muted};font-family:Georgia,serif;">${doc.description}</p>` : ''}
                        ${doc.publicUrl ? `
                        <table cellpadding="0" cellspacing="0" role="presentation">
                          <tr>
                            <td style="background-color:${brand.accent};border-radius:5px;">
                              <a href="${doc.publicUrl}" style="display:inline-block;padding:7px 16px;color:${brand.white};text-decoration:none;font-size:12px;font-family:Georgia,serif;letter-spacing:0.04em;font-weight:bold;">Download &rarr;</a>
                            </td>
                          </tr>
                        </table>` : '<p style="margin:0;font-size:12px;color:' + brand.muted + ';font-family:Georgia,serif;">Link unavailable — please contact us.</p>'}
                      </td>
                    </tr>
                  </table>`).join('')}
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 36px 28px;">
            <div style="background-color:rgba(53,94,59,0.06);border:1px solid rgba(53,94,59,0.15);border-radius:10px;padding:18px 22px;">
              <p style="margin:0 0 6px;font-size:13px;font-weight:bold;color:#355E3B;font-family:Georgia,serif;">Questions before your consultation?</p>
              <p style="margin:0 0 12px;font-size:13px;color:${brand.muted};font-family:Georgia,serif;line-height:1.6;">Feel free to reply to this email or access your client portal to upload documents and send messages.</p>
              <table cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="border:1px solid rgba(53,94,59,0.4);border-radius:6px;">
                    <a href="${SITE_URL}/portal/dashboard" style="display:inline-block;padding:10px 20px;color:#355E3B;text-decoration:none;font-size:12px;font-family:Georgia,serif;letter-spacing:0.05em;font-weight:bold;">Go to Portal &rarr;</a>
                  </td>
                </tr>
              </table>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background-color:${brand.secondary};padding:20px 36px;border-top:1px solid ${brand.border};">
            <p style="margin:0;font-size:11px;color:${brand.muted};font-family:Georgia,serif;">Maggi May Broussard Legal Services &nbsp;&middot;&nbsp; Louisiana &amp; Nationwide</p>
            <p style="margin:6px 0 0;font-size:11px;color:${brand.muted};font-family:Georgia,serif;">
              <a href="${SITE_URL}" style="color:${brand.accent};text-decoration:none;">${SITE_URL.replace('https://', '')}</a>
              &nbsp;&middot;&nbsp;
              <a href="mailto:broussardlegalservices@gmail.com" style="color:${brand.accent};text-decoration:none;">broussardlegalservices@gmail.com</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clientEmail, clientName, documents } = body as {
      clientEmail: string;
      clientName: string;
      bookingId?: string;
      inquiryId?: string;
      documents: PrepDoc[];
    };

    if (!clientEmail || !documents?.length) {
      return NextResponse.json({ error: 'clientEmail and documents are required' }, { status: 400 });
    }

    if (!RESEND_API_KEY || RESEND_API_KEY === 'your-resend-api-key-here') {
      return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 503 });
    }

    const html = buildPrepDocsEmail(clientName, documents);

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: [clientEmail],
        subject: `Consultation Prep Materials — Maggi May Broussard`,
        html,
      }),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.json().catch(() => ({}));
      throw new Error((errBody as { message?: string }).message || `Resend error ${resendRes.status}`);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to send prep docs email' },
      { status: 500 }
    );
  }
}
