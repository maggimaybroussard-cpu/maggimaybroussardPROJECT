import { NextRequest, NextResponse } from 'next/server';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://broussardlegalservices.com';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'broussardlegalservices@gmail.com';

const brand = {
  bg: '#FAF7F2',
  primary: '#4A3728',
  accent: '#C8965A',
  foreground: '#2C1F14',
  muted: '#7A6B5D',
  border: '#D9D0C5',
  secondary: '#EDE8E0',
  white: '#FFFFFF',
  success: '#355E3B',
  successLight: '#EAF2EB',
};

function buildAdminLeadEmail(params: {
  leadName: string;
  leadEmail: string;
  service: string;
  message: string;
  source: string;
  inquiryId: string;
  phone?: string;
  firmName?: string;
}): string {
  const { leadName, leadEmail, service, message, source, inquiryId, phone, firmName } = params;
  const sourceLabel = source === 'typeform_intake' ? 'Intake Form' : source === 'contact_form' ? 'Contact Form' : source === 'calendly' ? 'Calendly Booking' : source;
  const submittedAt = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Lead — ${leadName}</title>
</head>
<body style="margin:0; padding:0; background-color:${brand.secondary}; font-family:Georgia,'Times New Roman',serif; -webkit-text-size-adjust:100%;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:${brand.secondary}; padding:40px 16px;">
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
                        <p style="margin:4px 0 0; font-size:12px; color:rgba(255,255,255,0.65); font-family:Georgia,serif; letter-spacing:0.06em;">Admin Notification</p>
                      </td>
                    </tr>
                  </table>
                </td>
                <td style="text-align:right; vertical-align:middle;">
                  <p style="margin:0; font-size:11px; color:${brand.accent}; letter-spacing:0.12em; text-transform:uppercase; font-family:Georgia,serif;">New Lead</p>
                  <p style="margin:4px 0 0; font-size:13px; color:${brand.white}; font-family:Georgia,serif; font-weight:bold;">#${inquiryId.slice(0, 8).toUpperCase()}</p>
                </td>
              </tr>
            </table>
            <div style="height:1px; background:linear-gradient(to right,${brand.accent},rgba(200,150,90,0.2),transparent); margin:0 36px;"></div>
            <div style="height:20px;"></div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 36px 0;">
            <span style="display:inline-block; background-color:${brand.success}; color:${brand.white}; font-size:10px; font-weight:bold; letter-spacing:0.12em; text-transform:uppercase; padding:4px 14px; border-radius:20px; margin-bottom:18px; font-family:Georgia,serif;">&#9733; New Lead Received</span>
            <h2 style="margin:0 0 20px; font-size:21px; color:${brand.foreground}; font-family:Georgia,'Times New Roman',serif; font-weight:normal; border-bottom:1px solid ${brand.border}; padding-bottom:14px;">New inquiry from ${leadName}</h2>
          </td>
        </tr>
        <tr>
          <td style="padding:0 36px 32px;">
            <p style="margin:0 0 20px; font-size:15px; color:${brand.foreground}; line-height:1.8; font-family:Georgia,serif;">A new lead has been submitted via <strong>${sourceLabel}</strong> on ${submittedAt}. Review the details below and follow up promptly.</p>
            <div style="background-color:${brand.white}; border:1px solid ${brand.border}; border-radius:12px; overflow:hidden; margin:0 0 24px;">
              <div style="background:linear-gradient(135deg,${brand.primary} 0%,#3A2A1E 100%); padding:14px 20px;">
                <p style="margin:0; font-size:11px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.14em; font-family:Georgia,serif;">Lead Details</p>
              </div>
              <table style="width:100%; border-collapse:collapse; font-family:Georgia,serif;">
                <tr>
                  <td style="padding:10px 20px; color:${brand.muted}; font-size:12px; width:38%; border-bottom:1px solid rgba(217,208,197,0.5);">Name</td>
                  <td style="padding:10px 20px; color:${brand.foreground}; font-size:13px; font-weight:bold; border-bottom:1px solid rgba(217,208,197,0.5);">${leadName}</td>
                </tr>
                <tr>
                  <td style="padding:10px 20px; color:${brand.muted}; font-size:12px; border-bottom:1px solid rgba(217,208,197,0.5);">Email</td>
                  <td style="padding:10px 20px; border-bottom:1px solid rgba(217,208,197,0.5);"><a href="mailto:${leadEmail}" style="color:${brand.accent}; font-size:13px; text-decoration:none; font-family:Georgia,serif;">${leadEmail}</a></td>
                </tr>
                ${phone ? `<tr><td style="padding:10px 20px; color:${brand.muted}; font-size:12px; border-bottom:1px solid rgba(217,208,197,0.5);">Phone</td><td style="padding:10px 20px; color:${brand.foreground}; font-size:13px; font-weight:bold; border-bottom:1px solid rgba(217,208,197,0.5);">${phone}</td></tr>` : ''}
                ${firmName ? `<tr><td style="padding:10px 20px; color:${brand.muted}; font-size:12px; border-bottom:1px solid rgba(217,208,197,0.5);">Firm / Company</td><td style="padding:10px 20px; color:${brand.foreground}; font-size:13px; font-weight:bold; border-bottom:1px solid rgba(217,208,197,0.5);">${firmName}</td></tr>` : ''}
                <tr>
                  <td style="padding:10px 20px; color:${brand.muted}; font-size:12px; border-bottom:1px solid rgba(217,208,197,0.5);">Service Requested</td>
                  <td style="padding:10px 20px; color:${brand.foreground}; font-size:13px; font-weight:bold; border-bottom:1px solid rgba(217,208,197,0.5);">${service}</td>
                </tr>
                <tr>
                  <td style="padding:10px 20px; color:${brand.muted}; font-size:12px; border-bottom:1px solid rgba(217,208,197,0.5);">Source</td>
                  <td style="padding:10px 20px; color:${brand.foreground}; font-size:13px; border-bottom:1px solid rgba(217,208,197,0.5);">${sourceLabel}</td>
                </tr>
                <tr>
                  <td style="padding:10px 20px; color:${brand.muted}; font-size:12px; border-bottom:1px solid rgba(217,208,197,0.5);">Inquiry ID</td>
                  <td style="padding:10px 20px; color:${brand.muted}; font-size:12px; font-family:monospace; border-bottom:1px solid rgba(217,208,197,0.5);">${inquiryId}</td>
                </tr>
                <tr>
                  <td style="padding:10px 20px; color:${brand.muted}; font-size:12px; vertical-align:top;">Message</td>
                  <td style="padding:10px 20px; color:${brand.foreground}; font-size:13px; line-height:1.7;">${message.replace(/\n/g, '<br/>')}</td>
                </tr>
              </table>
            </div>
            <table cellpadding="0" cellspacing="0" role="presentation" style="margin:22px 0;">
              <tr>
                <td style="background-color:${brand.accent}; border-radius:7px; box-shadow:0 2px 8px rgba(200,150,90,0.25);">
                  <a href="${SITE_URL}/admin" style="display:inline-block; padding:13px 28px; color:${brand.white}; text-decoration:none; font-size:13px; font-family:Georgia,serif; letter-spacing:0.05em; font-weight:bold;">View in Admin Dashboard &rarr;</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background-color:${brand.secondary}; padding:20px 36px; border-top:1px solid ${brand.border};">
            <p style="margin:0; font-size:11px; color:${brand.muted}; line-height:1.7; font-family:Georgia,serif;">This is an automated admin notification from Broussard Legal Services.</p>
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
    const { leadName, leadEmail, service, message, source, inquiryId, phone, firmName } = body;

    if (!leadName || !leadEmail || !inquiryId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!RESEND_API_KEY || RESEND_API_KEY === 'your-resend-api-key-here') {
      console.warn('[new-lead] RESEND_API_KEY not configured — skipping admin lead notification');
      return NextResponse.json({ success: true, skipped: true });
    }

    const html = buildAdminLeadEmail({ leadName, leadEmail, service: service ?? 'Not specified', message: message ?? '(no message)', source: source ?? 'website', inquiryId, phone, firmName });

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Broussard Legal Services <maggimay@broussardlegalservices.com>',
        to: [ADMIN_EMAIL],
        subject: `🔔 New Lead: ${leadName} — ${service ?? 'Inquiry'}`,
        html,
      }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error((errBody as { message?: string }).message || `Resend API error: ${res.status}`);
    }

    const data = await res.json() as { id: string };
    return NextResponse.json({ success: true, emailId: data.id });
  } catch (err) {
    console.error('[new-lead]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to send lead notification' },
      { status: 500 }
    );
  }
}
