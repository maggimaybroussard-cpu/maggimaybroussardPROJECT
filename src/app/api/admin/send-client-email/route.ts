import { NextRequest, NextResponse } from 'next/server';

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
                  <a href="https://broussardlegalservices.com" style="color:${brand.accent}; text-decoration:none;">broussardlegalservices.com</a>
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

function getTemplateContent(
  templateId: string,
  client: { name: string; email: string; firm: string; service: string; consultationDate?: string },
  customMessage?: string
): { subject: string; bodyHtml: string } {
  const firstName = client.name.split(' ')[0];
  const consultationDateStr = client.consultationDate
    ? new Date(client.consultationDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : 'your scheduled consultation';

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

  switch (templateId) {
    case 'consultation_reminder':
      return {
        subject: `Reminder: Your Consultation on ${consultationDateStr} — Maggi May Broussard`,
        bodyHtml: `
          ${p(`Dear ${firstName},`)}
          ${p(`This is a friendly reminder that your consultation is scheduled for <strong>${consultationDateStr}</strong>. I look forward to speaking with you about your ${client.service} needs.`)}
          ${p(`Please don't hesitate to reach out if you need to reschedule or have any questions beforehand.`)}
          ${cta('Book or Reschedule', 'https://broussardlegalservices.com/book-consultation')}
          ${p(`Warm regards,<br/><strong>Maggi May Broussard</strong><br/>Paralegal Services`)}
        `,
      };

    case 'follow_up':
      return {
        subject: `Following Up — Maggi May Broussard`,
        bodyHtml: `
          ${p(`Dear ${firstName},`)}
          ${p(`I wanted to follow up after our recent consultation regarding your ${client.service} matter. It was a pleasure speaking with you, and I hope I was able to provide some clarity.`)}
          ${p(`If you have any additional questions or are ready to move forward, please don't hesitate to reach out. I'm here to help every step of the way.`)}
          ${cta('Contact Me', 'https://broussardlegalservices.com/contact')}
          ${p(`Warm regards,<br/><strong>Maggi May Broussard</strong><br/>Paralegal Services`)}
        `,
      };

    case 'proposal_ready':
      return {
        subject: `Your Proposal is Ready — Maggi May Broussard`,
        bodyHtml: `
          ${p(`Dear ${firstName},`)}
          ${p(`I'm pleased to let you know that I've prepared a proposal for your ${client.service} project. I believe this outlines a clear path forward for your needs.`)}
          ${p(`Please review the details at your convenience, and feel free to contact me with any questions or to discuss next steps.`)}
          ${cta('Schedule a Call', 'https://broussardlegalservices.com/book-consultation')}
          ${p(`Warm regards,<br/><strong>Maggi May Broussard</strong><br/>Paralegal Services`)}
        `,
      };

    case 'welcome_client':
      return {
        subject: `Welcome — Let's Get Started! — Maggi May Broussard`,
        bodyHtml: `
          ${p(`Dear ${firstName},`)}
          ${p(`Welcome! I'm thrilled to be working with you and ${client.firm} on your ${client.service} needs. I'm committed to providing you with exceptional paralegal support.`)}
          ${p(`To get started, please log in to your client portal where you can upload documents, track your case progress, and communicate with me directly.`)}
          ${cta('Access Your Portal', 'https://broussardlegalservices.com/portal/login')}
          ${p(`Warm regards,<br/><strong>Maggi May Broussard</strong><br/>Paralegal Services`)}
        `,
      };

    case 'document_request':
      return {
        subject: `Documents Needed — Maggi May Broussard`,
        bodyHtml: `
          ${p(`Dear ${firstName},`)}
          ${p(`To move forward with your ${client.service} matter, I'll need a few documents from you. Please upload them at your earliest convenience through your secure client portal.`)}
          ${p(`If you have any questions about what's needed or how to upload documents, please don't hesitate to reach out.`)}
          ${cta('Upload Documents', 'https://broussardlegalservices.com/portal/login')}
          ${p(`Warm regards,<br/><strong>Maggi May Broussard</strong><br/>Paralegal Services`)}
        `,
      };

    case 'custom':
      return {
        subject: `Message from Maggi May Broussard`,
        bodyHtml: `
          ${p(`Dear ${firstName},`)}
          ${customMessage
            ? customMessage.split('\n').map((line) => line.trim() ? p(line) : '').join('')
            : p('Thank you for your continued trust in my services.')}
          ${p(`Warm regards,<br/><strong>Maggi May Broussard</strong><br/>Paralegal Services`)}
        `,
      };

    default:
      return {
        subject: `Message from Maggi May Broussard`,
        bodyHtml: p(`Dear ${firstName}, thank you for your continued trust in my services.`),
      };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { templateId, clientEmail, clientName, clientFirm, clientService, consultationDate, customMessage, customSubject } = body;

    if (!templateId || !clientEmail || !clientName) {
      return NextResponse.json({ error: 'Missing required fields: templateId, clientEmail, clientName' }, { status: 400 });
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY || RESEND_API_KEY === 'your-resend-api-key-here') {
      return NextResponse.json({ error: 'RESEND_API_KEY is not configured. Please add your Resend API key to the environment variables.' }, { status: 503 });
    }

    const client = {
      name: clientName,
      email: clientEmail,
      firm: clientFirm || '',
      service: clientService || '',
      consultationDate,
    };

    const { subject, bodyHtml } = getTemplateContent(templateId, client, customMessage);
    const finalSubject = templateId === 'custom' && customSubject ? customSubject : subject;
    const html = buildEmailHtml(finalSubject, bodyHtml);

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'maggimay@broussardlegalservices.com',
        to: [clientEmail],
        subject: finalSubject,
        html,
      }),
    });

    if (!res.ok) {
      const errBody = await res.json();
      throw new Error(errBody.message || 'Resend API error');
    }

    const data = await res.json();
    return NextResponse.json({ success: true, emailId: data.id, subject: finalSubject });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to send email' },
      { status: 500 }
    );
  }
}
