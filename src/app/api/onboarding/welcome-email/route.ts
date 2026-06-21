import { NextRequest, NextResponse } from 'next/server';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://broussardlegalservices.com';
const PORTAL_URL = process.env.NEXT_PUBLIC_SITE_URL
  ? `${process.env.NEXT_PUBLIC_SITE_URL}/portal/dashboard`
  : 'https://broussardlegalservices.com/portal/dashboard';

const PORTAL_WELCOME_URL = process.env.NEXT_PUBLIC_SITE_URL
  ? `${process.env.NEXT_PUBLIC_SITE_URL}/portal/welcome`
  : 'https://broussardlegalservices.com/portal/welcome';

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

function emailWrapper(content: string, preheader = ''): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Your Portal — Maggi May Broussard</title>
  ${preheader ? `<div style="display:none;font-size:1px;color:#fefefe;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</div>` : ''}
</head>
<body style="margin:0; padding:0; background-color:#EDE8E0; font-family: Georgia, 'Times New Roman', serif; -webkit-text-size-adjust:100%;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#EDE8E0; padding: 40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px; width:100%; background-color:${brand.bg}; border-radius:14px; overflow:hidden; border: 1px solid ${brand.border}; box-shadow: 0 4px 24px rgba(74,55,40,0.10);">
        <!-- Header -->
        <tr>
          <td style="background-color:${brand.primary}; padding: 0;">
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
              </tr>
            </table>
            <div style="height:1px; background: linear-gradient(to right, ${brand.accent}, rgba(200,150,90,0.2), transparent); margin: 0 36px;"></div>
            <div style="height:20px;"></div>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding: 36px 36px 32px;">
            ${content}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background-color:${brand.secondary}; padding: 20px 36px; border-top: 1px solid ${brand.border};">
            <p style="margin:0 0 6px; font-size:12px; color:${brand.primary}; font-weight:bold; font-family: Georgia, serif; letter-spacing:0.04em;">Maggi May Broussard Legal Services</p>
            <p style="margin:0; font-size:11px; color:${brand.muted}; line-height:1.7;">
              You received this because you completed onboarding at <a href="${SITE_URL}" style="color:${brand.accent}; text-decoration:none;">maggimay.com</a>.
              &nbsp;·&nbsp;
              <a href="mailto:maggimaybroussard@gmail.com?subject=Unsubscribe" style="color:${brand.muted}; text-decoration:none;">Unsubscribe</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildWelcomeEmail(
  firstName: string,
  email: string,
  firmName: string,
  practiceArea: string,
  service: string
): { subject: string; html: string } {
  const subject = `Welcome to Your Portal, ${firstName} — Login Details & Quick-Start Guide`;

  const content = `
    <!-- Badge -->
    <span style="display:inline-block; background-color:${brand.green}; color:${brand.white}; font-size:10px; font-weight:bold; letter-spacing:0.12em; text-transform:uppercase; padding:4px 14px; border-radius:20px; margin-bottom:22px; font-family: Georgia, serif;">&#10003; Onboarding Complete</span>

    <!-- Greeting -->
    <h2 style="margin:0 0 16px; font-size:22px; color:${brand.foreground}; font-family: Georgia, 'Times New Roman', serif; font-weight:normal; letter-spacing:-0.01em; border-bottom:1px solid ${brand.border}; padding-bottom:14px;">
      Welcome, ${firstName} — Your Portal Is Ready
    </h2>
    <p style="margin:0 0 20px; font-size:15px; color:${brand.foreground}; line-height:1.8; font-family: Georgia, serif;">
      Congratulations on completing your onboarding. Your client portal is now fully activated. Below you'll find your login details, a summary of your retainer terms, and a quick-start guide to help you get the most out of your portal.
    </p>

    <!-- ── Portal Login Details ── -->
    <div style="background-color:${brand.bgCard}; border:1px solid ${brand.border}; border-radius:12px; overflow:hidden; margin:0 0 24px;">
      <div style="background: linear-gradient(135deg, ${brand.primary} 0%, #3A2A1E 100%); padding:14px 22px;">
        <p style="margin:0; font-size:11px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.14em; font-family: Georgia, serif;">&#128274; Portal Login Details</p>
      </div>
      <div style="padding:20px 22px;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;">
          <tr>
            <td style="padding:9px 0; color:${brand.muted}; font-size:13px; width:38%; border-bottom:1px solid rgba(217,208,197,0.5); font-family: Georgia, serif;">Portal URL</td>
            <td style="padding:9px 0; border-bottom:1px solid rgba(217,208,197,0.5);">
              <a href="${PORTAL_URL}" style="color:${brand.accent}; font-size:14px; text-decoration:none; font-family: Georgia, serif; font-weight:bold;">${PORTAL_URL}</a>
            </td>
          </tr>
          <tr>
            <td style="padding:9px 0; color:${brand.muted}; font-size:13px; border-bottom:1px solid rgba(217,208,197,0.5); font-family: Georgia, serif;">Email</td>
            <td style="padding:9px 0; color:${brand.foreground}; font-size:14px; font-weight:bold; border-bottom:1px solid rgba(217,208,197,0.5); font-family: Georgia, serif;">${email}</td>
          </tr>
          <tr>
            <td style="padding:9px 0; color:${brand.muted}; font-size:13px; font-family: Georgia, serif;">Password</td>
            <td style="padding:9px 0; color:${brand.foreground}; font-size:14px; font-family: Georgia, serif;">Use the password you set during registration. <a href="${SITE_URL}/portal/forgot-password" style="color:${brand.accent}; text-decoration:none; font-size:13px;">Forgot it?</a></td>
          </tr>
        </table>
      </div>
    </div>

    <!-- CTA Button -->
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin: 0 0 28px;">
      <tr>
        <td style="background-color:${brand.accent}; border-radius:7px; box-shadow: 0 2px 8px rgba(200,150,90,0.30);">
          <a href="${PORTAL_URL}" style="display:inline-block; padding:14px 36px; color:${brand.white}; text-decoration:none; font-size:14px; font-family: Georgia, serif; letter-spacing:0.05em; font-weight:bold;">Access My Portal &rarr;</a>
        </td>
      </tr>
    </table>

    <!-- ── Retainer Terms Summary ── -->
    <div style="background-color:${brand.bgCard}; border:1px solid ${brand.border}; border-radius:12px; overflow:hidden; margin:0 0 24px;">
      <div style="background: linear-gradient(135deg, ${brand.primary} 0%, #3A2A1E 100%); padding:14px 22px;">
        <p style="margin:0; font-size:11px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.14em; font-family: Georgia, serif;">&#128196; Retainer Terms Summary</p>
      </div>
      <div style="padding:20px 22px;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;">
          ${firmName ? `<tr>
            <td style="padding:9px 0; color:${brand.muted}; font-size:13px; width:42%; border-bottom:1px solid rgba(217,208,197,0.5); font-family: Georgia, serif;">Firm / Organization</td>
            <td style="padding:9px 0; color:${brand.foreground}; font-size:14px; font-weight:bold; border-bottom:1px solid rgba(217,208,197,0.5); font-family: Georgia, serif;">${firmName}</td>
          </tr>` : ''}
          ${practiceArea ? `<tr>
            <td style="padding:9px 0; color:${brand.muted}; font-size:13px; border-bottom:1px solid rgba(217,208,197,0.5); font-family: Georgia, serif;">Practice Area</td>
            <td style="padding:9px 0; color:${brand.foreground}; font-size:14px; font-weight:bold; border-bottom:1px solid rgba(217,208,197,0.5); font-family: Georgia, serif;">${practiceArea}</td>
          </tr>` : ''}
          ${service ? `<tr>
            <td style="padding:9px 0; color:${brand.muted}; font-size:13px; border-bottom:1px solid rgba(217,208,197,0.5); font-family: Georgia, serif;">Service Engaged</td>
            <td style="padding:9px 0; color:${brand.foreground}; font-size:14px; font-weight:bold; border-bottom:1px solid rgba(217,208,197,0.5); font-family: Georgia, serif;">${service}</td>
          </tr>` : ''}
          <tr>
            <td style="padding:9px 0; color:${brand.muted}; font-size:13px; border-bottom:1px solid rgba(217,208,197,0.5); font-family: Georgia, serif;">Retainer Agreement</td>
            <td style="padding:9px 0; color:${brand.foreground}; font-size:14px; border-bottom:1px solid rgba(217,208,197,0.5); font-family: Georgia, serif;">&#10003; Accepted &amp; on file</td>
          </tr>
          <tr>
            <td style="padding:9px 0; color:${brand.muted}; font-size:13px; border-bottom:1px solid rgba(217,208,197,0.5); font-family: Georgia, serif;">Billing Cycle</td>
            <td style="padding:9px 0; color:${brand.foreground}; font-size:14px; border-bottom:1px solid rgba(217,208,197,0.5); font-family: Georgia, serif;">Monthly — invoices issued on the 1st</td>
          </tr>
          <tr>
            <td style="padding:9px 0; color:${brand.muted}; font-size:13px; border-bottom:1px solid rgba(217,208,197,0.5); font-family: Georgia, serif;">Payment Terms</td>
            <td style="padding:9px 0; color:${brand.foreground}; font-size:14px; border-bottom:1px solid rgba(217,208,197,0.5); font-family: Georgia, serif;">Net 15 days from invoice date</td>
          </tr>
          <tr>
            <td style="padding:9px 0; color:${brand.muted}; font-size:13px; font-family: Georgia, serif;">Confidentiality</td>
            <td style="padding:9px 0; color:${brand.foreground}; font-size:14px; font-family: Georgia, serif;">All communications are strictly confidential</td>
          </tr>
        </table>
        <p style="margin:14px 0 0; font-size:12px; color:${brand.muted}; line-height:1.7; font-family: Georgia, serif;">
          Your full retainer agreement is available in the <a href="${PORTAL_URL}" style="color:${brand.accent}; text-decoration:none;">Documents</a> section of your portal. For questions about your terms, reply to this email or contact us directly.
        </p>
      </div>
    </div>

    <!-- ── Quick-Start Guide ── -->
    <div style="background-color:${brand.accentLight}; border:1px solid rgba(200,150,90,0.35); border-radius:12px; padding:22px 24px; margin:0 0 28px;">
      <p style="margin:0 0 16px; font-size:13px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.12em; font-family: Georgia, serif;">&#9889; Quick-Start Guide</p>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td style="padding:0 0 14px; vertical-align:top; width:28px;">
            <div style="width:22px; height:22px; border-radius:50%; background-color:${brand.accent}; text-align:center; line-height:22px; font-size:11px; font-weight:bold; color:${brand.white}; font-family: Georgia, serif;">1</div>
          </td>
          <td style="padding:0 0 14px 10px; vertical-align:top;">
            <p style="margin:0 0 3px; font-size:14px; color:${brand.foreground}; font-weight:bold; font-family: Georgia, serif;">Log In to Your Portal</p>
            <p style="margin:0; font-size:13px; color:${brand.muted}; line-height:1.6; font-family: Georgia, serif;">Visit <a href="${PORTAL_URL}" style="color:${brand.accent}; text-decoration:none;">${PORTAL_URL}</a> and sign in with your email and password.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 0 14px; vertical-align:top; width:28px;">
            <div style="width:22px; height:22px; border-radius:50%; background-color:${brand.accent}; text-align:center; line-height:22px; font-size:11px; font-weight:bold; color:${brand.white}; font-family: Georgia, serif;">2</div>
          </td>
          <td style="padding:0 0 14px 10px; vertical-align:top;">
            <p style="margin:0 0 3px; font-size:14px; color:${brand.foreground}; font-weight:bold; font-family: Georgia, serif;">Review Your Case Dashboard</p>
            <p style="margin:0; font-size:13px; color:${brand.muted}; line-height:1.6; font-family: Georgia, serif;">Your dashboard shows your active case status, recent activity, and any pending action items from Maggi May.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 0 14px; vertical-align:top; width:28px;">
            <div style="width:22px; height:22px; border-radius:50%; background-color:${brand.accent}; text-align:center; line-height:22px; font-size:11px; font-weight:bold; color:${brand.white}; font-family: Georgia, serif;">3</div>
          </td>
          <td style="padding:0 0 14px 10px; vertical-align:top;">
            <p style="margin:0 0 3px; font-size:14px; color:${brand.foreground}; font-weight:bold; font-family: Georgia, serif;">Upload &amp; Sign Documents</p>
            <p style="margin:0; font-size:13px; color:${brand.muted}; line-height:1.6; font-family: Georgia, serif;">Navigate to <strong>Documents</strong> to upload case files or e-sign any pending agreements. All files are encrypted and securely stored.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 0 14px; vertical-align:top; width:28px;">
            <div style="width:22px; height:22px; border-radius:50%; background-color:${brand.accent}; text-align:center; line-height:22px; font-size:11px; font-weight:bold; color:${brand.white}; font-family: Georgia, serif;">4</div>
          </td>
          <td style="padding:0 0 14px 10px; vertical-align:top;">
            <p style="margin:0 0 3px; font-size:14px; color:${brand.foreground}; font-weight:bold; font-family: Georgia, serif;">Track Invoices &amp; Payments</p>
            <p style="margin:0; font-size:13px; color:${brand.muted}; line-height:1.6; font-family: Georgia, serif;">Go to <strong>Billing</strong> to view outstanding invoices, payment history, and your retainer balance at any time.</p>
          </td>
        </tr>
        <tr>
          <td style="vertical-align:top; width:28px;">
            <div style="width:22px; height:22px; border-radius:50%; background-color:${brand.accent}; text-align:center; line-height:22px; font-size:11px; font-weight:bold; color:${brand.white}; font-family: Georgia, serif;">5</div>
          </td>
          <td style="padding-left:10px; vertical-align:top;">
            <p style="margin:0 0 3px; font-size:14px; color:${brand.foreground}; font-weight:bold; font-family: Georgia, serif;">Contact Maggi May Directly</p>
            <p style="margin:0; font-size:13px; color:${brand.muted}; line-height:1.6; font-family: Georgia, serif;">Reply to this email or reach out at <a href="mailto:maggimaybroussard@gmail.com" style="color:${brand.accent}; text-decoration:none;">maggimaybroussard@gmail.com</a> for any questions about your case.</p>
          </td>
        </tr>
      </table>
    </div>

    <!-- Signature -->
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:28px; border-top:1px solid ${brand.border}; padding-top:20px; width:100%;">
      <tr>
        <td>
          <p style="margin:0 0 4px; font-size:15px; color:${brand.foreground}; font-family: Georgia, serif;">Warm regards,</p>
          <p style="margin:0 0 2px; font-size:16px; color:${brand.primary}; font-weight:bold; font-family: Georgia, serif;">Maggi May Broussard</p>
          <p style="margin:0 0 6px; font-size:12px; color:${brand.muted}; font-family: Georgia, serif; letter-spacing:0.04em;">Licensed Paralegal · Louisiana &amp; Nationwide</p>
          <a href="mailto:maggimaybroussard@gmail.com" style="color:${brand.accent}; font-size:13px; text-decoration:none; font-family: Georgia, serif;">maggimaybroussard@gmail.com</a>
          &nbsp;<span style="color:${brand.border};">|</span>&nbsp;
          <a href="${SITE_URL}" style="color:${brand.accent}; font-size:13px; text-decoration:none; font-family: Georgia, serif;">maggimay.com</a>
        </td>
      </tr>
    </table>
  `;

  return { subject, html: emailWrapper(content, `Your portal is ready, ${firstName}! Log in to access your case files, documents, and billing.`) };
}

export async function POST(req: NextRequest) {
  try {
    if (!RESEND_API_KEY || RESEND_API_KEY === 'your-resend-api-key-here') {
      return NextResponse.json({ error: 'RESEND_API_KEY is not configured' }, { status: 500 });
    }

    const body = await req.json();
    const { email, firstName, firmName = '', practiceArea = '', service = '' } = body;

    if (!email || !firstName) {
      return NextResponse.json({ error: 'email and firstName are required' }, { status: 400 });
    }

    const { subject, html } = buildWelcomeEmail(firstName, email, firmName, practiceArea, service);

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'maggimay@broussardlegalservices.com',
        to: [email],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const errBody = await res.json();
      throw new Error(errBody.message || 'Resend API error');
    }

    const data = await res.json();
    return NextResponse.json({ success: true, id: data.id });
  } catch (error: any) {
    console.error('Onboarding welcome email error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
