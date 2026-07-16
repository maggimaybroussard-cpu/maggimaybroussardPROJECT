import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://broussardlegalservices.com';

const brand = {
  bg: '#FAF7F2',
  primary: '#4A3728',
  accent: '#C8965A',
  foreground: '#2C1F14',
  muted: '#7A6B5D',
  border: '#D9D0C5',
  secondary: '#EDE8E0',
  white: '#FFFFFF',
};

function buildMessageEmail(params: {
  recipientName: string;
  recipientEmail: string;
  senderName: string;
  senderRole: 'admin' | 'client';
  messageBody: string;
  caseName?: string;
  portalUrl: string;
}): string {
  const { recipientName, senderName, senderRole, messageBody, caseName, portalUrl } = params;
  const firstName = recipientName.split(' ')[0];
  const isAdminSender = senderRole === 'admin';
  const badge = isAdminSender ? 'New Message from Your Legal Team' : 'New Client Message';
  const heading = isAdminSender
    ? `You have a new message, ${firstName}`
    : `New message from ${senderName}`;

  const bodyHtml = messageBody
    .split('\n')
    .filter((l) => l.trim())
    .map(
      (line) =>
        `<p style="margin:0 0 12px; font-size:15px; color:${brand.foreground}; line-height:1.8; font-family:Georgia,'Times New Roman',serif;">${line}</p>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${badge}</title>
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
                        <p style="margin:4px 0 0; font-size:12px; color:rgba(255,255,255,0.65); font-family:Georgia,serif; letter-spacing:0.06em;">Louisiana &amp; Nationwide</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <div style="height:1px; background:linear-gradient(to right,${brand.accent},rgba(200,150,90,0.2),transparent); margin:0 36px;"></div>
            <div style="height:20px;"></div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 36px 0;">
            <span style="display:inline-block; background-color:${brand.accent}; color:${brand.white}; font-size:10px; font-weight:bold; letter-spacing:0.12em; text-transform:uppercase; padding:4px 14px; border-radius:20px; margin-bottom:18px; font-family:Georgia,serif;">&#9993; ${badge}</span>
            <h2 style="margin:0 0 20px; font-size:21px; color:${brand.foreground}; font-family:Georgia,'Times New Roman',serif; font-weight:normal; border-bottom:1px solid ${brand.border}; padding-bottom:14px;">${heading}</h2>
          </td>
        </tr>
        <tr>
          <td style="padding:0 36px 32px;">
            ${caseName ? `<p style="margin:0 0 16px; font-size:13px; color:${brand.muted}; font-family:Georgia,serif;">Re: <strong style="color:${brand.foreground};">${caseName}</strong></p>` : ''}
            <div style="background-color:${brand.white}; border:1px solid ${brand.border}; border-left:3px solid ${brand.accent}; border-radius:0 8px 8px 0; padding:18px 22px; margin:0 0 22px;">
              <p style="margin:0 0 8px; font-size:11px; color:${brand.muted}; font-weight:bold; text-transform:uppercase; letter-spacing:0.1em; font-family:Georgia,serif;">${senderName} wrote:</p>
              ${bodyHtml}
            </div>
            <table cellpadding="0" cellspacing="0" role="presentation" style="margin:22px 0;">
              <tr>
                <td style="background-color:${brand.accent}; border-radius:7px; box-shadow:0 2px 8px rgba(200,150,90,0.25);">
                  <a href="${portalUrl}" style="display:inline-block; padding:13px 28px; color:${brand.white}; text-decoration:none; font-size:13px; font-family:Georgia,serif; letter-spacing:0.05em; font-weight:bold;">Reply in Portal &rarr;</a>
                </td>
              </tr>
            </table>
            <table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:24px; border-top:1px solid ${brand.border}; padding-top:18px; width:100%;">
              <tr>
                <td>
                  <p style="margin:0 0 4px; font-size:15px; color:${brand.foreground}; font-family:Georgia,serif;">Warm regards,</p>
                  <p style="margin:0 0 2px; font-size:16px; color:${brand.primary}; font-weight:bold; font-family:Georgia,serif;">Maggi May Broussard</p>
                  <p style="margin:0 0 6px; font-size:12px; color:${brand.muted}; font-family:Georgia,serif; letter-spacing:0.04em;">Licensed Paralegal · Louisiana &amp; Nationwide</p>
                  <a href="mailto:broussardlegalservices@gmail.com" style="color:${brand.accent}; font-size:13px; text-decoration:none; font-family:Georgia,serif;">broussardlegalservices@gmail.com</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background-color:${brand.secondary}; padding:20px 36px; border-top:1px solid ${brand.border};">
            <p style="margin:0 0 4px; font-size:12px; color:${brand.primary}; font-weight:bold; font-family:Georgia,serif; letter-spacing:0.04em;">Maggi May Broussard Legal Services</p>
            <p style="margin:0; font-size:11px; color:${brand.muted}; line-height:1.7; font-family:Georgia,serif;">
              You received this because you have an active matter with Broussard Legal Services.
              <a href="${SITE_URL}" style="color:${brand.accent}; text-decoration:none;">Visit our site</a>
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
    const {
      recipientName,
      recipientEmail,
      recipientUserId,
      senderName,
      senderRole,
      messageBody,
      caseName,
      portalUrl,
    } = body;

    if (!recipientEmail || !recipientName || !senderName || !messageBody) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check client's notification preference for new messages (only for client recipients)
    if (recipientUserId && senderRole === 'admin') {
      try {
        const supabase = await createServerClient();
        const { data: profileData } = await supabase
          .from('user_profiles')
          .select('notification_prefs')
          .eq('id', recipientUserId)
          .maybeSingle();

        if (profileData?.notification_prefs) {
          const prefs = profileData.notification_prefs as Record<string, boolean>;
          if (prefs.new_message === false) {
            return NextResponse.json({ success: true, skipped: true, reason: 'Client opted out of message notifications' });
          }
        }
      } catch {
        // If preference check fails, proceed with sending
      }
    }

    if (!RESEND_API_KEY || RESEND_API_KEY === 'your-resend-api-key-here') {
      console.warn('[new-message] RESEND_API_KEY not configured — skipping notification');
      return NextResponse.json({ success: true, skipped: true });
    }

    const html = buildMessageEmail({ recipientName, recipientEmail, senderName, senderRole, messageBody, caseName, portalUrl: portalUrl ?? `${SITE_URL}/portal/messages` });

    const subject = senderRole === 'admin'
      ? `New message from your legal team${caseName ? ` — ${caseName}` : ''}`
      : `New message from ${senderName}${caseName ? ` — ${caseName}` : ''}`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Maggi May Broussard <maggimay@broussardlegalservices.com>',
        reply_to: 'broussardlegalservices@gmail.com',
        to: [recipientEmail],
        subject,
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
    console.error('[new-message]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to send message notification' },
      { status: 500 }
    );
  }
}
