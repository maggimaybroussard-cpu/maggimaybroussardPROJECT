import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://broussardlegalservices.com';

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

/**
 * POST /api/review/trigger
 * Manually trigger a Google review request email via Resend.
 * Body: { inquiryId, clientEmail, clientName, service }
 * Can also be called automatically after consultation completion.
 */
export async function POST(req: NextRequest) {
  try {
    const { inquiryId, clientEmail, clientName, service } = await req.json();

    if (!inquiryId || !clientEmail || !clientName) {
      return NextResponse.json({ error: 'inquiryId, clientEmail, and clientName are required.' }, { status: 400 });
    }

    if (!RESEND_API_KEY || RESEND_API_KEY === 'your-resend-api-key-here') {
      return NextResponse.json({ error: 'RESEND_API_KEY is not configured.' }, { status: 503 });
    }

    const supabase = await createClient();

    // Check if a review request already exists for this inquiry
    const { data: existing } = await supabase
      .from('review_requests')
      .select('id, submitted, token')
      .eq('inquiry_id', inquiryId)
      .maybeSingle();

    if (existing?.submitted) {
      return NextResponse.json({ message: 'Review already submitted for this inquiry.', skipped: true });
    }

    let token: string;
    let reviewRequestId: string;

    if (existing) {
      token = existing.token;
      reviewRequestId = existing.id;
    } else {
      // Create a new review request
      const { data: newReview, error: reviewErr } = await supabase
        .from('review_requests')
        .insert({
          inquiry_id: inquiryId,
          client_name: clientName,
          client_email: clientEmail,
          service: service ?? null,
        })
        .select('id, token')
        .single();

      if (reviewErr || !newReview) {
        return NextResponse.json({ error: reviewErr?.message || 'Failed to create review request.' }, { status: 500 });
      }

      token = newReview.token;
      reviewRequestId = newReview.id;
    }

    const reviewUrl = `${SITE_URL}/review/${token}`;
    const firstName = clientName.split(' ')[0];
    const serviceName = service ?? 'legal support';

    const subject = `How did your ${serviceName} go, ${firstName}? ⭐`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Share Your Experience — Broussard Legal Services</title>
</head>
<body style="margin:0;padding:0;background-color:#EDE8E0;font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#EDE8E0;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:${brand.bg};border-radius:14px;overflow:hidden;border:1px solid ${brand.border};box-shadow:0 4px 24px rgba(74,55,40,0.10);">
        <!-- HEADER -->
        <tr>
          <td style="background-color:${brand.primary};padding:0;">
            <div style="height:4px;background:linear-gradient(to right,${brand.accent},#E8B87A,${brand.accent});"></div>
            <table width="100%" cellpadding="0" cellspacing="0" style="padding:28px 36px 24px;">
              <tr>
                <td>
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="border-right:2px solid ${brand.accent};padding-right:14px;vertical-align:middle;">
                        <p style="margin:0;font-size:10px;color:${brand.accent};letter-spacing:0.18em;text-transform:uppercase;line-height:1.4;">Paralegal</p>
                        <p style="margin:0;font-size:10px;color:${brand.accent};letter-spacing:0.18em;text-transform:uppercase;line-height:1.4;">Services</p>
                      </td>
                      <td style="padding-left:14px;vertical-align:middle;">
                        <h1 style="margin:0;font-size:22px;color:${brand.white};font-weight:normal;letter-spacing:0.01em;line-height:1.2;">Broussard Legal Services</h1>
                        <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.65);letter-spacing:0.06em;">Louisiana &amp; Nationwide</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <div style="height:1px;background:linear-gradient(to right,${brand.accent},rgba(200,150,90,0.2),transparent);margin:0 36px;"></div>
            <div style="height:20px;"></div>
          </td>
        </tr>
        <!-- BODY -->
        <tr>
          <td style="padding:32px 36px 0;">
            <span style="display:inline-block;background-color:${brand.accent};color:${brand.white};font-size:10px;font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;padding:4px 14px;border-radius:20px;margin-bottom:22px;">&#9733;&nbsp; Share Your Experience</span>
            <h2 style="margin:0 0 20px;font-size:21px;color:${brand.foreground};font-weight:normal;border-bottom:1px solid ${brand.border};padding-bottom:14px;">How did your ${serviceName} go?</h2>
          </td>
        </tr>
        <tr>
          <td style="padding:0 36px 32px;">
            <p style="margin:0 0 16px;font-size:15px;color:${brand.foreground};line-height:1.8;">Dear ${firstName},</p>
            <p style="margin:0 0 20px;font-size:15px;color:${brand.foreground};line-height:1.8;">
              It was a pleasure working with you on your <strong>${serviceName}</strong>. I hope our time together was valuable and that you feel well-supported moving forward.
            </p>
            <p style="margin:0 0 24px;font-size:15px;color:${brand.foreground};line-height:1.8;">
              Your feedback helps other attorneys and legal professionals find the right support — and it means a great deal to me personally. If you have a moment, I would love to hear about your experience.
            </p>
            <!-- Star rating prompt -->
            <div style="background-color:${brand.accentLight};border:1px solid rgba(200,150,90,0.3);border-radius:10px;padding:24px 28px;margin:0 0 28px;text-align:center;">
              <p style="margin:0 0 8px;font-size:13px;color:${brand.muted};letter-spacing:0.06em;text-transform:uppercase;">Rate your experience</p>
              <p style="margin:0 0 20px;font-size:28px;letter-spacing:4px;">&#9733;&#9733;&#9733;&#9733;&#9733;</p>
              <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="background-color:${brand.accent};border-radius:8px;box-shadow:0 3px 12px rgba(200,150,90,0.35);">
                    <a href="${reviewUrl}" style="display:inline-block;padding:16px 44px;color:${brand.white};text-decoration:none;font-size:15px;letter-spacing:0.05em;font-weight:bold;">Leave My Review &rarr;</a>
                  </td>
                </tr>
              </table>
              <p style="margin:16px 0 0;font-size:12px;color:${brand.muted};">Takes less than 60 seconds &nbsp;&middot;&nbsp; No account required</p>
            </div>
            <p style="margin:0 0 20px;font-size:14px;color:${brand.muted};line-height:1.8;">
              Or copy and paste this link:<br>
              <a href="${reviewUrl}" style="color:${brand.accent};word-break:break-all;font-size:13px;">${reviewUrl}</a>
            </p>
            <!-- Signature -->
            <table cellpadding="0" cellspacing="0" style="margin-top:28px;border-top:1px solid ${brand.border};padding-top:20px;width:100%;">
              <tr>
                <td>
                  <p style="margin:0 0 4px;font-size:15px;color:${brand.foreground};">With gratitude,</p>
                  <p style="margin:0 0 2px;font-size:16px;color:${brand.primary};font-weight:bold;">Broussard Legal Services</p>
                  <p style="margin:0 0 6px;font-size:12px;color:${brand.muted};letter-spacing:0.04em;">Licensed Paralegal &middot; Louisiana &amp; Nationwide</p>
                  <a href="mailto:maggimay@broussardlegalservices.com" style="color:${brand.accent};font-size:13px;text-decoration:none;">maggimay@broussardlegalservices.com</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- FOOTER -->
        <tr>
          <td style="background-color:${brand.secondary};padding:20px 36px;border-top:1px solid ${brand.border};">
            <p style="margin:0 0 6px;font-size:12px;color:${brand.primary};font-weight:bold;letter-spacing:0.04em;">Broussard Legal Services</p>
            <p style="margin:0;font-size:11px;color:${brand.muted};line-height:1.7;">
              You are receiving this email because you worked with Broussard Legal Services. Your feedback is entirely optional. If you prefer not to receive follow-up emails, simply reply to this message.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    // Send via Resend
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'maggimay@broussardlegalservices.com',
        to: [clientEmail],
        subject,
        html,
      }),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.json().catch(() => ({}));
      return NextResponse.json({ error: errBody.message || 'Resend API error' }, { status: 500 });
    }

    const resendData = await resendRes.json();

    // Log the send in review_requests
    await supabase
      .from('review_requests')
      .update({ sent_at: new Date().toISOString() } as Record<string, unknown>)
      .eq('id', reviewRequestId);

    return NextResponse.json({
      success: true,
      reviewRequestId,
      resendId: resendData.id,
      reviewUrl,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
