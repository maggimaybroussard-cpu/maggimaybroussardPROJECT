/**
 * Consultation alert email templates for confirmed, rescheduled, and completed events.
 * Sent via Resend API using the existing branded email style.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://broussardlegalservices.com';
const FROM_EMAIL = 'maggimay@broussardlegalservices.com';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'maggimaybroussard@gmail.com';

const brand = {
  bg: '#FAF7F2',
  primary: '#4A3728',
  accent: '#C8965A',
  foreground: '#2C1F14',
  muted: '#7A6B5D',
  border: '#D9D0C5',
  secondary: '#EDE8E0',
  white: '#FFFFFF',
  green: '#355E3B',
  greenLight: '#EAF2EB',
  blue: '#1D4ED8',
  blueLight: '#EFF6FF',
  amber: '#B45309',
  amberLight: '#FFFBEB',
};

export type ConsultationAlertType = 'confirmed' | 'rescheduled' | 'completed';

export interface ConsultationAlertParams {
  resendApiKey: string;
  clientEmail: string;
  clientName: string;
  alertType: ConsultationAlertType;
  bookingDate: string;       // e.g. "Monday, June 16, 2026"
  bookingTime: string;       // e.g. "2:00 PM CST"
  bookingType: string;       // e.g. "Initial Consultation"
  meetingLocation?: string;  // e.g. "Google Meet"
  notes?: string;
  portalLink?: string;
}

function getAlertMeta(alertType: ConsultationAlertType): {
  badge: string;
  heading: string;
  badgeBg: string;
  badgeColor: string;
  intro: string;
  icon: string;
} {
  switch (alertType) {
    case 'confirmed':
      return {
        badge: 'Consultation Confirmed',
        heading: 'Your Consultation is Confirmed',
        badgeBg: brand.greenLight,
        badgeColor: brand.green,
        intro: 'Great news — your consultation with Maggi May Broussard has been confirmed. Please review the details below and add this to your calendar.',
        icon: '✓',
      };
    case 'rescheduled':
      return {
        badge: 'Consultation Rescheduled',
        heading: 'Your Consultation Has Been Rescheduled',
        badgeBg: brand.amberLight,
        badgeColor: brand.amber,
        intro: 'Your consultation with Maggi May Broussard has been rescheduled. Please review the updated details below.',
        icon: '↻',
      };
    case 'completed':
      return {
        badge: 'Consultation Completed',
        heading: 'Thank You for Your Consultation',
        badgeBg: brand.blueLight,
        badgeColor: brand.blue,
        intro: 'Thank you for meeting with Maggi May Broussard. We hope your consultation was helpful. If you have any follow-up questions or are ready to move forward, please do not hesitate to reach out.',
        icon: '★',
      };
  }
}

function buildConsultationAlertHtml(params: ConsultationAlertParams): string {
  const meta = getAlertMeta(params.alertType);
  const firstName = params.clientName.split(' ')[0] ?? params.clientName;
  const portalLink = params.portalLink ?? `${SITE_URL}/portal/dashboard`;

  const detailsSection =
    params.alertType !== 'completed'
      ? `
    <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%; background-color:${brand.secondary}; border-radius:10px; border:1px solid ${brand.border}; margin:20px 0;">
      <tr>
        <td style="padding:20px 24px;">
          <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
            <tr>
              <td style="padding:8px 0; border-bottom:1px solid ${brand.border};">
                <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
                  <tr>
                    <td style="font-size:11px; color:${brand.muted}; font-family:Georgia,serif; letter-spacing:0.08em; text-transform:uppercase; width:40%;">Type</td>
                    <td style="font-size:14px; color:${brand.foreground}; font-family:Georgia,serif; font-weight:bold;">${params.bookingType}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 0; border-bottom:1px solid ${brand.border};">
                <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
                  <tr>
                    <td style="font-size:11px; color:${brand.muted}; font-family:Georgia,serif; letter-spacing:0.08em; text-transform:uppercase; width:40%;">Date</td>
                    <td style="font-size:14px; color:${brand.foreground}; font-family:Georgia,serif;">${params.bookingDate}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 0; border-bottom:1px solid ${brand.border};">
                <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
                  <tr>
                    <td style="font-size:11px; color:${brand.muted}; font-family:Georgia,serif; letter-spacing:0.08em; text-transform:uppercase; width:40%;">Time</td>
                    <td style="font-size:14px; color:${brand.foreground}; font-family:Georgia,serif;">${params.bookingTime}</td>
                  </tr>
                </table>
              </td>
            </tr>
            ${params.meetingLocation ? `
            <tr>
              <td style="padding:8px 0;">
                <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
                  <tr>
                    <td style="font-size:11px; color:${brand.muted}; font-family:Georgia,serif; letter-spacing:0.08em; text-transform:uppercase; width:40%;">Location</td>
                    <td style="font-size:14px; color:${brand.foreground}; font-family:Georgia,serif;">${params.meetingLocation}</td>
                  </tr>
                </table>
              </td>
            </tr>` : ''}
          </table>
        </td>
      </tr>
    </table>`
      : '';

  const notesSection =
    params.notes
      ? `<p style="margin:0 0 14px; font-size:14px; color:${brand.muted}; line-height:1.7; font-family:Georgia,serif; font-style:italic; border-left:3px solid ${brand.accent}; padding-left:14px;">${params.notes}</p>`
      : '';

  const ctaSection =
    params.alertType === 'completed'
      ? `
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin:22px 0;">
      <tr>
        <td style="background-color:${brand.primary}; border-radius:7px; box-shadow:0 2px 8px rgba(74,55,40,0.20); margin-right:10px;">
          <a href="${portalLink}" style="display:inline-block; padding:13px 28px; color:${brand.white}; text-decoration:none; font-size:13px; font-family:Georgia,serif; letter-spacing:0.05em; font-weight:bold;">Access Your Portal &rarr;</a>
        </td>
      </tr>
    </table>`
      : `
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin:22px 0;">
      <tr>
        <td style="background-color:${brand.accent}; border-radius:7px; box-shadow:0 2px 8px rgba(200,150,90,0.25);">
          <a href="${portalLink}" style="display:inline-block; padding:13px 28px; color:${brand.white}; text-decoration:none; font-size:13px; font-family:Georgia,serif; letter-spacing:0.05em; font-weight:bold;">View in Portal &rarr;</a>
        </td>
      </tr>
    </table>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${meta.heading} — Maggi May Broussard</title>
</head>
<body style="margin:0;padding:0;background-color:${brand.secondary};font-family:Georgia,'Times New Roman',serif;-webkit-text-size-adjust:100%;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:${brand.secondary};padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background-color:${brand.bg};border-radius:14px;overflow:hidden;border:1px solid ${brand.border};box-shadow:0 4px 24px rgba(74,55,40,0.10);">

        <!-- HEADER -->
        <tr>
          <td style="background-color:${brand.primary};padding:0;">
            <div style="height:4px;background:linear-gradient(to right,${brand.accent},#E8B87A,${brand.accent});"></div>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="padding:28px 36px 24px;">
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
                <td align="right" style="vertical-align:middle;">
                  <div style="width:44px;height:44px;border-radius:50%;background-color:${meta.badgeBg};display:inline-flex;align-items:center;justify-content:center;font-size:20px;color:${meta.badgeColor};font-family:Georgia,serif;line-height:44px;text-align:center;">${meta.icon}</div>
                </td>
              </tr>
            </table>
            <div style="height:1px;background:linear-gradient(to right,${brand.accent},rgba(200,150,90,0.2),transparent);margin:0 36px;"></div>
            <div style="height:20px;"></div>
          </td>
        </tr>

        <!-- BADGE -->
        <tr>
          <td style="padding:28px 36px 0;">
            <span style="display:inline-block;background-color:${meta.badgeBg};color:${meta.badgeColor};font-size:10px;font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;padding:5px 16px;border-radius:20px;margin-bottom:18px;font-family:Georgia,serif;border:1px solid ${meta.badgeColor}22;">${meta.badge}</span>
            <h2 style="margin:0 0 16px;font-size:22px;color:${brand.foreground};font-family:Georgia,serif;font-weight:normal;border-bottom:1px solid ${brand.border};padding-bottom:14px;">${meta.heading}</h2>
          </td>
        </tr>

        <!-- BODY -->
        <tr>
          <td style="padding:0 36px 32px;">
            <p style="margin:0 0 16px;font-size:15px;color:${brand.foreground};line-height:1.8;font-family:Georgia,serif;">Dear ${firstName},</p>
            <p style="margin:0 0 16px;font-size:15px;color:${brand.foreground};line-height:1.8;font-family:Georgia,serif;">${meta.intro}</p>

            ${detailsSection}
            ${notesSection}
            ${ctaSection}

            <!-- Signature -->
            <table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:24px;border-top:1px solid ${brand.border};padding-top:18px;width:100%;">
              <tr>
                <td>
                  <p style="margin:0 0 4px;font-size:15px;color:${brand.foreground};font-family:Georgia,serif;">Warm regards,</p>
                  <p style="margin:0 0 2px;font-size:16px;color:${brand.primary};font-weight:bold;font-family:Georgia,serif;">Maggi May Broussard</p>
                  <p style="margin:0 0 6px;font-size:12px;color:${brand.muted};font-family:Georgia,serif;letter-spacing:0.04em;">Licensed Paralegal · Louisiana &amp; Nationwide</p>
                  <a href="mailto:broussardlegalservices@gmail.com" style="color:${brand.accent};font-size:13px;text-decoration:none;font-family:Georgia,serif;">broussardlegalservices@gmail.com</a>
                  &nbsp;<span style="color:${brand.border};">|</span>&nbsp;
                  <a href="${SITE_URL}" style="color:${brand.accent};font-size:13px;text-decoration:none;font-family:Georgia,serif;">${SITE_URL.replace(/^https?:\/\//, '')}</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="background-color:${brand.secondary};padding:20px 36px;border-top:1px solid ${brand.border};">
            <p style="margin:0 0 4px;font-size:12px;color:${brand.primary};font-weight:bold;font-family:Georgia,serif;letter-spacing:0.04em;">Maggi May Broussard Legal Services</p>
            <p style="margin:0;font-size:11px;color:${brand.muted};line-height:1.7;font-family:Georgia,serif;">
              You received this because you have an active consultation with Broussard Legal Services.
              <a href="${SITE_URL}" style="color:${brand.accent};text-decoration:none;">Visit our site</a>
              &nbsp;&middot;&nbsp;
              <a href="mailto:broussardlegalservices@gmail.com?subject=Unsubscribe" style="color:${brand.muted};text-decoration:none;">Unsubscribe</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendConsultationAlertEmail(
  params: ConsultationAlertParams
): Promise<{ sent: boolean; error?: string }> {
  const { resendApiKey, clientEmail, alertType } = params;

  if (!resendApiKey || resendApiKey === 'your-resend-api-key-here') {
    return { sent: false, error: 'RESEND_API_KEY not configured' };
  }

  const meta = getAlertMeta(alertType);
  const html = buildConsultationAlertHtml(params);

  const subjectMap: Record<ConsultationAlertType, string> = {
    confirmed: `Consultation Confirmed — ${params.bookingDate} at ${params.bookingTime}`,
    rescheduled: `Consultation Rescheduled — ${params.bookingDate} at ${params.bookingTime}`,
    completed: `Thank You for Your Consultation — Next Steps`,
  };

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [clientEmail],
        bcc: [ADMIN_EMAIL],
        subject: subjectMap[alertType],
        html,
      }),
    });

    if (res.ok) {
      return { sent: true };
    }
    const err = await res.json().catch(() => ({}));
    return {
      sent: false,
      error: `Resend error: ${(err as { message?: string }).message ?? res.status}`,
    };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : String(e) };
  }
}
