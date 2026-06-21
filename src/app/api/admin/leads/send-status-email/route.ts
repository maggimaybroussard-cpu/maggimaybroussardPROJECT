import { NextRequest, NextResponse } from 'next/server';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://broussardlegalservices.com';

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
};

const headerHtml = `
  <div style="height:4px; background: linear-gradient(to right, ${brand.accent}, #E8B87A, ${brand.accent});"></div>
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="padding: 28px 36px 24px; background-color:${brand.primary};">
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
    </tr>
  </table>
  <div style="height:1px; background: linear-gradient(to right, ${brand.accent}, rgba(200,150,90,0.2), transparent); margin: 0 36px; background-color:${brand.primary};"></div>
  <div style="height:20px; background-color:${brand.primary};"></div>
`;

function buildEmailHtml(subject: string, bodyHtml: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0; padding:0; background-color:${brand.secondary}; font-family:Georgia,'Times New Roman',serif;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:${brand.secondary}; padding:40px 16px;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px; width:100%; background-color:${brand.bg}; border-radius:14px; overflow:hidden; border:1px solid ${brand.border}; box-shadow: 0 4px 24px rgba(74,55,40,0.10);">
            <tr><td style="background-color:${brand.primary}; padding:0;">${headerHtml}</td></tr>
            <tr>
              <td style="padding:32px 36px 0;">
                <h2 style="margin:0 0 20px; font-size:21px; color:${brand.foreground}; font-family: Georgia, serif; font-weight:normal; border-bottom:1px solid ${brand.border}; padding-bottom:14px;">${subject}</h2>
              </td>
            </tr>
            <tr>
              <td style="padding:0 36px 32px;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="background-color:${brand.secondary}; padding:20px 36px; border-top:1px solid ${brand.border};">
                <p style="margin:0; font-size:11px; color:${brand.muted}; font-family:Georgia,serif;">Maggi May Broussard Legal Services &nbsp;·&nbsp; Louisiana &amp; Nationwide</p>
                <p style="margin:6px 0 0; font-size:11px; color:${brand.muted}; font-family:Georgia,serif;">
                  <a href="${SITE_URL}" style="color:${brand.accent}; text-decoration:none;">${SITE_URL.replace('https://', '')}</a>
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

const p = (text: string) =>
  `<p style="margin:0 0 16px; font-size:15px; color:${brand.foreground}; line-height:1.8; font-family:Georgia,serif;">${text}</p>`;

const cta = (label: string, href: string) => `
  <table cellpadding="0" cellspacing="0" role="presentation" style="margin:20px 0;">
    <tr>
      <td style="background-color:${brand.accent}; border-radius:7px; box-shadow: 0 2px 8px rgba(200,150,90,0.25);">
        <a href="${href}" style="display:inline-block; padding:13px 28px; color:${brand.white}; text-decoration:none; font-size:13px; font-family:Georgia,serif; letter-spacing:0.05em; font-weight:bold;">${label} &rarr;</a>
      </td>
    </tr>
  </table>
`;

const statusBadge = (label: string, color: string) =>
  `<span style="display:inline-block; padding:6px 16px; background-color:${color}; border-radius:20px; font-size:13px; font-family:Georgia,serif; font-weight:bold; letter-spacing:0.04em;">${label}</span>`;

interface StatusConfig {
  label: string;
  badgeColor: string;
  subject: string;
  nextSteps: string[];
}

const STATUS_CONFIG: Record<string, StatusConfig> = {
  lead: {
    label: 'Lead',
    badgeColor: '#DBEAFE',
    subject: 'Your Inquiry Has Been Received — Maggi May Broussard',
    nextSteps: [
      'We have received your inquiry and are reviewing your information.',
      'A member of our team will reach out to schedule your consultation.',
      'In the meantime, feel free to explore our services or contact us with any questions.',
    ],
  },
  prospect: {
    label: 'Prospect',
    badgeColor: '#EDE9FE',
    subject: 'Moving Forward With Your Matter — Maggi May Broussard',
    nextSteps: [
      'We have reviewed your information and are ready to move forward.',
      'Please complete your intake questionnaire if you have not already done so.',
      'We will be in touch shortly to confirm next steps for your matter.',
    ],
  },
  client: {
    label: 'Active Client',
    badgeColor: '#D1FAE5',
    subject: 'Welcome — Your Matter Is Now Active — Maggi May Broussard',
    nextSteps: [
      'Your matter is now active and we are ready to begin work on your behalf.',
      'Please log in to your secure client portal to upload documents, track progress, and communicate with our team.',
      'You will receive updates as your matter progresses. Do not hesitate to reach out with any questions.',
    ],
  },
  lost: {
    label: 'Closed',
    badgeColor: '#FEE2E2',
    subject: 'Regarding Your Matter — Maggi May Broussard',
    nextSteps: [
      'Thank you for considering Maggi May Broussard Legal Services.',
      'At this time, we are unable to move forward with your matter.',
      'Should your circumstances change or you have future legal needs, we welcome you to reach out.',
    ],
  },
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      clientName,
      clientEmail,
      newStatus,
      previousStatus,
      matterName,
      bookingType,
    }: {
      clientName: string;
      clientEmail: string;
      newStatus: string;
      previousStatus?: string;
      matterName?: string;
      bookingType?: string;
    } = body;

    if (!clientName || !clientEmail || !newStatus) {
      return NextResponse.json(
        { error: 'Missing required fields: clientName, clientEmail, newStatus' },
        { status: 400 }
      );
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY || RESEND_API_KEY === 'your-resend-api-key-here') {
      return NextResponse.json(
        { error: 'RESEND_API_KEY is not configured.' },
        { status: 503 }
      );
    }

    const config = STATUS_CONFIG[newStatus] ?? STATUS_CONFIG['lead'];
    const firstName = clientName.split(' ')[0];
    const portalLink = `${SITE_URL}/portal/login`;
    const matterDisplay = matterName || bookingType?.replace(/_/g, ' ') || 'your legal matter';

    const bodyHtml = `
      ${p(`Dear ${firstName},`)}
      ${p(`We are writing to inform you of an update regarding <strong>${matterDisplay}</strong>.`)}
      <div style="margin:20px 0; padding:16px 20px; background-color:${brand.accentLight}; border-left:4px solid ${brand.accent}; border-radius:0 8px 8px 0;">
        <p style="margin:0 0 8px; font-size:12px; color:${brand.muted}; font-family:Georgia,serif; text-transform:uppercase; letter-spacing:0.1em;">Matter Status</p>
        ${statusBadge(config.label, config.badgeColor)}
      </div>
      <p style="margin:0 0 12px; font-size:14px; font-weight:bold; color:${brand.foreground}; font-family:Georgia,serif; text-transform:uppercase; letter-spacing:0.08em;">Next Steps</p>
      <ul style="margin:0 0 20px; padding-left:20px;">
        ${config.nextSteps.map((step) => `<li style="margin-bottom:10px; font-size:15px; color:${brand.foreground}; line-height:1.7; font-family:Georgia,serif;">${step}</li>`).join('')}
      </ul>
      ${newStatus !== 'lost' ? cta('Access Your Client Portal', portalLink) : ''}
      ${p(`If you have any questions, please do not hesitate to contact us at <a href="${SITE_URL}/contact" style="color:${brand.accent}; text-decoration:none;">broussardlegalservices.com/contact</a>.`)}
      ${p(`Warm regards,<br/><strong>Maggi May Broussard</strong><br/>Paralegal Services`)}
    `;

    const html = buildEmailHtml(config.subject, bodyHtml);

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'maggimay@broussardlegalservices.com',
        to: [clientEmail],
        subject: config.subject,
        html,
      }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error((errBody as { message?: string }).message || `Resend API error: ${res.status}`);
    }

    const data = await res.json() as { id?: string };
    return NextResponse.json({
      success: true,
      emailId: data.id,
      subject: config.subject,
      sentTo: clientEmail,
      newStatus,
      previousStatus,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to send status email' },
      { status: 500 }
    );
  }
}
