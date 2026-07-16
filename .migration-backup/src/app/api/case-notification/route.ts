import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://broussardlegalservices.com';

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
  green: '#355E3B',
  greenLight: '#EAF2EB',
};

const STATUS_LABELS: Record<string, string> = {
  new: 'Received',
  in_review: 'In Review',
  contacted: 'In Progress',
  closed: 'Closed',
};

function buildCaseEmail(params: {
  clientName: string;
  clientEmail: string;
  caseName: string;
  caseId: string;
  service: string;
  status: string;
  message: string;
  eventType: 'created' | 'updated';
  notes?: string;
}): string {
  const { clientName, caseName, caseId, service, status, message, eventType, notes } = params;
  const firstName = clientName.split(' ')[0];
  const statusLabel = STATUS_LABELS[status] ?? status;
  const isCreated = eventType === 'created';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${isCreated ? 'Case Received' : 'Case Update'} — Broussard Legal Services</title>
</head>
<body style="margin:0; padding:0; background-color:#EDE8E0; font-family: Georgia, 'Times New Roman', serif; -webkit-text-size-adjust:100%;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#EDE8E0; padding: 40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px; width:100%; background-color:${brand.bg}; border-radius:14px; overflow:hidden; border: 1px solid ${brand.border}; box-shadow: 0 4px 24px rgba(74,55,40,0.10);">

        <!-- Header -->
        <tr>
          <td style="background-color:${brand.primary}; padding:0;">
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
                <td style="text-align:right; vertical-align:middle;">
                  <p style="margin:0; font-size:11px; color:${brand.accent}; letter-spacing:0.12em; text-transform:uppercase; font-family: Georgia, serif;">${isCreated ? 'Case Received' : 'Case Update'}</p>
                  <p style="margin:4px 0 0; font-size:13px; color:${brand.white}; font-family: Georgia, serif; font-weight:bold;">#${caseId.slice(0, 8).toUpperCase()}</p>
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

            <!-- Status badge -->
            <span style="display:inline-block; background-color:${brand.green}; color:${brand.white}; font-size:10px; font-weight:bold; letter-spacing:0.12em; text-transform:uppercase; padding:4px 14px; border-radius:20px; margin-bottom:22px; font-family: Georgia, serif;">
              ${isCreated ? '&#10003; Case Submitted' : '&#8635; Status Updated'}
            </span>

            <!-- Greeting -->
            <h2 style="margin:0 0 16px; font-size:22px; color:${brand.foreground}; font-family: Georgia, 'Times New Roman', serif; font-weight:normal; border-bottom:1px solid ${brand.border}; padding-bottom:14px;">
              ${isCreated ? `Your case has been received, ${firstName}` : `Case update for ${firstName}`}
            </h2>

            <p style="margin:0 0 20px; font-size:15px; color:${brand.foreground}; line-height:1.8; font-family: Georgia, serif;">
              ${isCreated
                ? `Thank you for submitting your case to Broussard Legal Services. We have received your inquiry and will begin reviewing your matter promptly. You can track your case status at any time through your client portal.`
                : `There has been an update to your case. Please review the details below and log in to your client portal for the latest documents and communications.`
              }
            </p>

            <!-- Case details card -->
            <div style="background-color:${brand.white}; border:1px solid ${brand.border}; border-radius:12px; overflow:hidden; margin:0 0 28px;">
              <div style="background: linear-gradient(135deg, ${brand.primary} 0%, #3A2A1E 100%); padding:18px 24px;">
                <p style="margin:0; font-size:11px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.14em; font-family: Georgia, serif;">Case Details</p>
                <p style="margin:4px 0 0; font-size:17px; color:${brand.white}; font-family: Georgia, serif; font-weight:bold;">${caseName}</p>
              </div>
              <div style="padding:6px 24px 16px;">
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                  <tr>
                    <td style="padding:11px 0; border-bottom:1px solid rgba(217,208,197,0.5); vertical-align:top; width:40%;">
                      <p style="margin:0; font-size:12px; color:${brand.muted}; font-family: Georgia, serif; letter-spacing:0.04em; text-transform:uppercase;">Case Reference</p>
                    </td>
                    <td style="padding:11px 0 11px 16px; border-bottom:1px solid rgba(217,208,197,0.5); vertical-align:top; text-align:right;">
                      <p style="margin:0; font-size:13px; color:${brand.foreground}; font-family: Georgia, serif; font-weight:bold;">#${caseId.slice(0, 8).toUpperCase()}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:11px 0; border-bottom:1px solid rgba(217,208,197,0.5); vertical-align:top; width:40%;">
                      <p style="margin:0; font-size:12px; color:${brand.muted}; font-family: Georgia, serif; letter-spacing:0.04em; text-transform:uppercase;">Service Type</p>
                    </td>
                    <td style="padding:11px 0 11px 16px; border-bottom:1px solid rgba(217,208,197,0.5); vertical-align:top; text-align:right;">
                      <p style="margin:0; font-size:13px; color:${brand.foreground}; font-family: Georgia, serif; font-weight:bold;">${service}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:11px 0; border-bottom:1px solid rgba(217,208,197,0.5); vertical-align:top; width:40%;">
                      <p style="margin:0; font-size:12px; color:${brand.muted}; font-family: Georgia, serif; letter-spacing:0.04em; text-transform:uppercase;">Current Status</p>
                    </td>
                    <td style="padding:11px 0 11px 16px; border-bottom:1px solid rgba(217,208,197,0.5); vertical-align:top; text-align:right;">
                      <span style="display:inline-block; background-color:${brand.greenLight}; color:${brand.green}; font-size:11px; font-weight:bold; letter-spacing:0.08em; text-transform:uppercase; padding:3px 10px; border-radius:12px; font-family: Georgia, serif;">${statusLabel}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:11px 0; vertical-align:top; width:40%;">
                      <p style="margin:0; font-size:12px; color:${brand.muted}; font-family: Georgia, serif; letter-spacing:0.04em; text-transform:uppercase;">Matter Summary</p>
                    </td>
                    <td style="padding:11px 0 11px 16px; vertical-align:top; text-align:right;">
                      <p style="margin:0; font-size:13px; color:${brand.foreground}; font-family: Georgia, serif; line-height:1.6;">${message}</p>
                    </td>
                  </tr>
                </table>
              </div>
            </div>

            ${notes ? `
            <!-- Notes -->
            <div style="background-color:${brand.accentLight}; border:1px solid rgba(200,150,90,0.35); border-radius:10px; padding:20px 24px; margin:0 0 28px;">
              <p style="margin:0 0 8px; font-size:11px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.12em; font-family: Georgia, serif;">Notes from Maggi May</p>
              <p style="margin:0; font-size:13px; color:${brand.foreground}; line-height:1.7; font-family: Georgia, serif;">${notes}</p>
            </div>
            ` : ''}

            <!-- Next steps -->
            <div style="background-color:${brand.secondary}; border:1px solid ${brand.border}; border-radius:10px; padding:20px 24px; margin:0 0 28px;">
              <p style="margin:0 0 14px; font-size:11px; color:${brand.muted}; font-weight:bold; text-transform:uppercase; letter-spacing:0.12em; font-family: Georgia, serif;">Your Portal Access</p>
              <table cellpadding="0" cellspacing="0" role="presentation" width="100%">
                ${[
                  ['📁', 'View & upload case documents'],
                  ['📊', 'Track your case status in real time'],
                  ['📄', 'Access invoices and payment history'],
                  ['✍️', 'Review and sign documents electronically'],
                ].map(([icon, text]) => `
                <tr>
                  <td style="padding:5px 0; vertical-align:top; width:28px;">
                    <span style="font-size:14px;">${icon}</span>
                  </td>
                  <td style="padding:5px 0 5px 8px; vertical-align:top;">
                    <p style="margin:0; font-size:13px; color:${brand.foreground}; line-height:1.6; font-family: Georgia, serif;">${text}</p>
                  </td>
                </tr>`).join('')}
              </table>
            </div>

            <!-- CTA -->
            <table cellpadding="0" cellspacing="0" role="presentation" style="margin: 24px 0;">
              <tr>
                <td style="background-color:${brand.green}; border-radius:7px; box-shadow: 0 2px 8px rgba(53,94,59,0.30);">
                  <a href="${SITE_URL}/portal/cases" style="display:inline-block; padding:14px 36px; color:${brand.white}; text-decoration:none; font-size:14px; font-family: Georgia, serif; letter-spacing:0.05em; font-weight:bold;">View Your Case Portal &rarr;</a>
                </td>
              </tr>
            </table>

            <!-- Signature -->
            <table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:28px; border-top:1px solid ${brand.border}; padding-top:20px; width:100%;">
              <tr>
                <td>
                  <p style="margin:0 0 4px; font-size:15px; color:${brand.foreground}; font-family: Georgia, serif;">Warm regards,</p>
                  <p style="margin:0 0 2px; font-size:16px; color:${brand.primary}; font-weight:bold; font-family: Georgia, serif;">Maggi May Broussard</p>
                  <p style="margin:0 0 6px; font-size:12px; color:${brand.muted}; font-family: Georgia, serif; letter-spacing:0.04em;">Licensed Paralegal · Louisiana &amp; Nationwide</p>
                  <a href="mailto:broussardlegalservices@gmail.com" style="color:${brand.accent}; font-size:13px; text-decoration:none; font-family: Georgia, serif;">broussardlegalservices@gmail.com</a>
                  &nbsp;<span style="color:${brand.border};">|</span>&nbsp;
                  <a href="${SITE_URL}" style="color:${brand.accent}; font-size:13px; text-decoration:none; font-family: Georgia, serif;">maggimay.com</a>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background-color:${brand.secondary}; padding: 20px 36px; border-top: 1px solid ${brand.border};">
            <p style="margin:0 0 6px; font-size:12px; color:${brand.primary}; font-weight:bold; font-family: Georgia, serif; letter-spacing:0.04em;">Maggi May Broussard Legal Services</p>
            <p style="margin:0; font-size:11px; color:${brand.muted}; line-height:1.7;">
              You received this because you have an active case with Broussard Legal Services.
              <a href="${SITE_URL}" style="color:${brand.accent}; text-decoration:none;">Visit our site</a>
              &nbsp;·&nbsp;
              <a href="mailto:broussardlegalservices@gmail.com?subject=Unsubscribe" style="color:${brand.muted}; text-decoration:none;">Unsubscribe</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
  `.trim();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      clientName,
      clientEmail,
      clientUserId,
      caseName,
      caseId,
      service,
      status,
      message,
      eventType,
      notes,
    } = body;

    if (!clientEmail || !clientName || !caseId || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!RESEND_API_KEY || RESEND_API_KEY === 'your-resend-api-key-here') {
      console.warn('RESEND_API_KEY not configured — skipping case notification email');
      return NextResponse.json({ success: true, skipped: true });
    }

    // Check client's notification preference for case updates
    if (clientUserId) {
      try {
        const supabase = await createServerClient();
        const { data: profileData } = await supabase
          .from('user_profiles')
          .select('notification_prefs')
          .eq('id', clientUserId)
          .maybeSingle();

        if (profileData?.notification_prefs) {
          const prefs = profileData.notification_prefs as Record<string, boolean>;
          if (prefs.case_update === false) {
            return NextResponse.json({ success: true, skipped: true, reason: 'Client opted out of case update notifications' });
          }
        }
      } catch {
        // If preference check fails, proceed with sending
      }
    }

    const subject = eventType === 'created'
      ? `Case Received — ${caseName || 'Your Matter'} | Broussard Legal Services`
      : `Case Update — ${caseName || 'Your Matter'} | Broussard Legal Services`;

    const html = buildCaseEmail({
      clientName,
      clientEmail,
      caseName: caseName || 'Your Matter',
      caseId,
      service: service || 'Paralegal Services',
      status,
      message: message || 'No additional details provided.',
      eventType: eventType || 'created',
      notes,
    });

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'maggimay@broussardlegalservices.com',
        to: [clientEmail],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Resend error:', err);
      return NextResponse.json({ error: 'Failed to send email', detail: err }, { status: 500 });
    }

    const data = await res.json();
    return NextResponse.json({ success: true, id: data.id });
  } catch (err: unknown) {
    console.error('Case notification error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
