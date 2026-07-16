import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://broussardlegalservices.com';

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

interface TransactionalEmailPayload {
  // Recipient
  toEmail: string;
  toName: string;
  // Optional user ID to check notification preferences
  userId?: string;
  // Composer fields
  subject: string;
  badge?: string;
  heading?: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  // Branding overrides (optional)
  brandAccentColor?: string;
  brandHeaderColor?: string;
  signatureName?: string;
  signatureTitle?: string;
  signatureEmail?: string;
  // Event context (for logging/tracking)
  eventType?: 'case_update' | 'invoice' | 'task';
  templateId?: string;
  // Dynamic variable substitutions
  variables?: Record<string, string>;
}

// Mapping from eventType to notification_prefs key
const EVENT_TYPE_PREF_MAP: Record<string, string> = {
  case_update: 'case_update',
  invoice: 'invoice_issued',
};

function resolveVariables(text: string, vars: Record<string, string>): string {
  let result = text;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
  }
  return result;
}

function buildTransactionalHtml(payload: TransactionalEmailPayload): string {
  const accent = payload.brandAccentColor || brand.accent;
  const header = payload.brandHeaderColor || brand.primary;
  const sigName = payload.signatureName || 'Maggi May Broussard';
  const sigTitle = payload.signatureTitle || 'Licensed Paralegal · Louisiana & Nationwide';
  const sigEmail = payload.signatureEmail || 'broussardlegalservices@gmail.com';

  const vars = payload.variables ?? {};
  const subject = resolveVariables(payload.subject, vars);
  const badge = payload.badge ? resolveVariables(payload.badge, vars) : '';
  const heading = payload.heading ? resolveVariables(payload.heading, vars) : '';
  const ctaLabel = payload.ctaLabel ? resolveVariables(payload.ctaLabel, vars) : '';
  const ctaUrl = payload.ctaUrl
    ? resolveVariables(payload.ctaUrl, vars).replace('{{siteUrl}}', SITE_URL)
    : '';

  // Convert plain-text body to HTML paragraphs
  const bodyHtml = resolveVariables(payload.body, vars)
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      return `<p style="margin:0 0 14px; font-size:15px; color:${brand.foreground}; line-height:1.8; font-family:Georgia,'Times New Roman',serif;">${trimmed}</p>`;
    })
    .join('');

  const ctaHtml = ctaLabel && ctaUrl
    ? `
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin:22px 0;">
      <tr>
        <td style="background-color:${accent}; border-radius:7px; box-shadow:0 2px 8px rgba(200,150,90,0.25);">
          <a href="${ctaUrl}" style="display:inline-block; padding:13px 28px; color:${brand.white}; text-decoration:none; font-size:13px; font-family:Georgia,serif; letter-spacing:0.05em; font-weight:bold;">${ctaLabel} &rarr;</a>
        </td>
      </tr>
    </table>`
    : '';

  const badgeHtml = badge
    ? `<span style="display:inline-block; background-color:${accent}; color:${brand.white}; font-size:10px; font-weight:bold; letter-spacing:0.12em; text-transform:uppercase; padding:4px 14px; border-radius:20px; margin-bottom:18px; font-family:Georgia,serif;">${badge}</span>`
    : '';

  const headingHtml = heading
    ? `<h2 style="margin:0 0 20px; font-size:21px; color:${brand.foreground}; font-family:Georgia,serif; font-weight:normal; border-bottom:1px solid ${brand.border}; padding-bottom:14px;">${heading}</h2>`
    : `<h2 style="margin:0 0 20px; font-size:21px; color:${brand.foreground}; font-family:Georgia,serif; font-weight:normal; border-bottom:1px solid ${brand.border}; padding-bottom:14px;">${subject}</h2>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0; padding:0; background-color:${brand.secondary}; font-family:Georgia,'Times New Roman',serif; -webkit-text-size-adjust:100%;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:${brand.secondary}; padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px; width:100%; background-color:${brand.bg}; border-radius:14px; overflow:hidden; border:1px solid ${brand.border}; box-shadow:0 4px 24px rgba(74,55,40,0.10);">

        <!-- Header -->
        <tr>
          <td style="background-color:${header}; padding:0;">
            <div style="height:4px; background:linear-gradient(to right, ${accent}, #E8B87A, ${accent});"></div>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="padding:28px 36px 24px;">
              <tr>
                <td>
                  <table cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td style="border-right:2px solid ${accent}; padding-right:14px; vertical-align:middle;">
                        <p style="margin:0; font-size:10px; color:${accent}; letter-spacing:0.18em; text-transform:uppercase; font-family:Georgia,serif; line-height:1.4;">Paralegal</p>
                        <p style="margin:0; font-size:10px; color:${accent}; letter-spacing:0.18em; text-transform:uppercase; font-family:Georgia,serif; line-height:1.4;">Services</p>
                      </td>
                      <td style="padding-left:14px; vertical-align:middle;">
                        <h1 style="margin:0; font-size:24px; color:${brand.white}; font-family:Georgia,'Times New Roman',serif; font-weight:normal; letter-spacing:0.01em; line-height:1.2;">${sigName}</h1>
                        <p style="margin:4px 0 0; font-size:12px; color:rgba(255,255,255,0.65); font-family:Georgia,serif; letter-spacing:0.06em;">Louisiana &amp; Nationwide</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <div style="height:1px; background:linear-gradient(to right, ${accent}, rgba(200,150,90,0.2), transparent); margin:0 36px;"></div>
            <div style="height:20px;"></div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 36px 0;">
            ${badgeHtml}
            ${headingHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:0 36px 32px;">
            ${bodyHtml}
            ${ctaHtml}
            <!-- Signature -->
            <table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:24px; border-top:1px solid ${brand.border}; padding-top:18px; width:100%;">
              <tr>
                <td>
                  <p style="margin:0 0 4px; font-size:15px; color:${brand.foreground}; font-family:Georgia,serif;">Warm regards,</p>
                  <p style="margin:0 0 2px; font-size:16px; color:${header}; font-weight:bold; font-family:Georgia,serif;">${sigName}</p>
                  <p style="margin:0 0 6px; font-size:12px; color:${brand.muted}; font-family:Georgia,serif; letter-spacing:0.04em;">${sigTitle}</p>
                  <a href="mailto:${sigEmail}" style="color:${accent}; font-size:13px; text-decoration:none; font-family:Georgia,serif;">${sigEmail}</a>
                  &nbsp;<span style="color:${brand.border};">|</span>&nbsp;
                  <a href="${SITE_URL}" style="color:${accent}; font-size:13px; text-decoration:none; font-family:Georgia,serif;">${SITE_URL.replace(/^https?:\/\//, '')}</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background-color:${brand.secondary}; padding:20px 36px; border-top:1px solid ${brand.border};">
            <p style="margin:0 0 4px; font-size:12px; color:${header}; font-weight:bold; font-family:Georgia,serif; letter-spacing:0.04em;">Maggi May Broussard Legal Services</p>
            <p style="margin:0; font-size:11px; color:${brand.muted}; line-height:1.7; font-family:Georgia,serif;">
              You received this because you have an active matter with Broussard Legal Services.
              <a href="${SITE_URL}" style="color:${accent}; text-decoration:none;">Visit our site</a>
              &nbsp;&middot;&nbsp;
              <a href="mailto:${sigEmail}?subject=Unsubscribe" style="color:${brand.muted}; text-decoration:none;">Unsubscribe</a>
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
    const body: TransactionalEmailPayload = await req.json();

    const { toEmail, toName, subject, body: emailBody } = body;

    if (!toEmail || !toName || !subject || !emailBody) {
      return NextResponse.json(
        { error: 'Missing required fields: toEmail, toName, subject, body' },
        { status: 400 }
      );
    }

    if (!RESEND_API_KEY || RESEND_API_KEY === 'your-resend-api-key-here') {
      return NextResponse.json(
        { error: 'RESEND_API_KEY is not configured. Please add your Resend API key to the environment variables.' },
        { status: 503 }
      );
    }

    // Check notification preferences if userId and eventType are provided
    if (body.userId && body.eventType && EVENT_TYPE_PREF_MAP[body.eventType]) {
      try {
        const supabase = await createServerClient();
        const { data: profileData } = await supabase
          .from('user_profiles')
          .select('notification_prefs')
          .eq('id', body.userId)
          .maybeSingle();

        if (profileData?.notification_prefs) {
          const prefs = profileData.notification_prefs as Record<string, boolean>;
          const prefKey = EVENT_TYPE_PREF_MAP[body.eventType];
          if (prefs[prefKey] === false) {
            return NextResponse.json({
              success: true,
              skipped: true,
              reason: `Client opted out of ${body.eventType} notifications`,
            });
          }
        }
      } catch {
        // If preference check fails, proceed with sending
      }
    }

    const html = buildTransactionalHtml(body);

    // Resolve subject variables too
    const vars = body.variables ?? {};
    const resolvedSubject = resolveVariables(subject, vars);

    const sigEmail = body.signatureEmail || 'broussardlegalservices@gmail.com';
    const sigName = body.signatureName || 'Maggi May Broussard';

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${sigName} <maggimay@broussardlegalservices.com>`,
        reply_to: sigEmail,
        to: [toEmail],
        subject: resolvedSubject,
        html,
      }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error((errBody as { message?: string }).message || `Resend API error: ${res.status}`);
    }

    const data = await res.json() as { id: string };
    return NextResponse.json({
      success: true,
      emailId: data.id,
      subject: resolvedSubject,
      to: toEmail,
      eventType: body.eventType,
      templateId: body.templateId,
    });
  } catch (err) {
    console.error('[send-transactional]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to send transactional email' },
      { status: 500 }
    );
  }
}
