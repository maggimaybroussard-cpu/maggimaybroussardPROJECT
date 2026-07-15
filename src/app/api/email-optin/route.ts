import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { validateEmailOptIn } from '@/lib/sanitize';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

// ─── Confirmation Email ───────────────────────────────────────────────────────

function buildConfirmationEmail(
  email: string,
  confirmUrl: string
): { subject: string; html: string } {
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Confirm your subscription</title>
      <div style="display:none;font-size:1px;color:#fefefe;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">One quick step — confirm your email to receive your free Paralegal Readiness Checklist.</div>
    </head>
    <body style="margin:0;padding:0;background-color:${brand.secondary};font-family:Georgia,'Times New Roman',serif;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:${brand.secondary};padding:40px 16px;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background-color:${brand.bg};border-radius:14px;overflow:hidden;border:1px solid ${brand.border};box-shadow:0 4px 24px rgba(74,55,40,0.10);">

            <!-- Header -->
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
                  </tr>
                </table>
                <div style="height:1px;background:linear-gradient(to right,${brand.accent},rgba(200,150,90,0.2),transparent);margin:0 36px;"></div>
                <div style="height:20px;"></div>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:40px 36px 36px;text-align:center;">
                <!-- Icon -->
                <div style="width:64px;height:64px;border-radius:50%;background-color:${brand.accentLight};border:2px solid ${brand.accent};margin:0 auto 28px;display:flex;align-items:center;justify-content:center;line-height:64px;text-align:center;">
                  <span style="font-size:28px;color:${brand.accent};font-family:Georgia,serif;">&#9993;</span>
                </div>

                <!-- Badge -->
                <span style="display:inline-block;background-color:${brand.accent};color:${brand.white};font-size:10px;font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;padding:4px 14px;border-radius:20px;margin-bottom:22px;font-family:Georgia,serif;">One More Step</span>

                <h2 style="margin:0 0 16px;font-size:26px;color:${brand.foreground};font-family:Georgia,'Times New Roman',serif;font-weight:normal;line-height:1.3;">Please confirm your email</h2>

                <p style="margin:0 0 10px;font-size:15px;color:${brand.foreground};line-height:1.8;font-family:Georgia,serif;text-align:left;">
                  Thank you for requesting the <strong>Paralegal Readiness Checklist</strong>. To complete your subscription and receive your free resource, please confirm your email address by clicking the button below.
                </p>

                <p style="margin:0 0 32px;font-size:13px;color:${brand.muted};line-height:1.7;font-family:Georgia,serif;text-align:left;">
                  This confirmation step ensures your checklist reaches the right inbox and keeps our communications compliant.
                </p>

                <!-- CTA Button -->
                <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto 28px;">
                  <tr>
                    <td style="background-color:${brand.accent};border-radius:7px;box-shadow:0 2px 8px rgba(200,150,90,0.30);">
                      <a href="${confirmUrl}" style="display:inline-block;padding:16px 40px;color:${brand.white};text-decoration:none;font-size:15px;font-family:Georgia,serif;letter-spacing:0.05em;font-weight:bold;">Yes, confirm my subscription &rarr;</a>
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 8px;font-size:12px;color:${brand.muted};font-family:Georgia,serif;">
                  Button not working? Copy and paste this link into your browser:
                </p>
                <p style="margin:0 0 28px;font-size:11px;color:${brand.muted};font-family:Georgia,serif;word-break:break-all;">
                  <a href="${confirmUrl}" style="color:${brand.accent};text-decoration:none;">${confirmUrl}</a>
                </p>

                <p style="margin:0;font-size:12px;color:${brand.muted};font-family:Georgia,serif;text-align:left;">
                  If you did not request this, you can safely ignore this email — you will not be subscribed.
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background-color:${brand.secondary};padding:20px 36px;border-top:1px solid ${brand.border};">
                <p style="margin:0 0 6px;font-size:12px;color:${brand.primary};font-weight:bold;font-family:Georgia,serif;letter-spacing:0.04em;">Maggi May Broussard Legal Services</p>
                <p style="margin:0;font-size:11px;color:${brand.muted};line-height:1.7;">
                  You received this because ${email} was used to request the free Paralegal Readiness Checklist at
                  <a href="${SITE_URL}" style="color:${brand.accent};text-decoration:none;">maggimay.com</a>.
                  &nbsp;&middot;&nbsp;
                  <a href="mailto:maggimaybroussard@gmail.com?subject=Unsubscribe" style="color:${brand.muted};text-decoration:none;">Unsubscribe</a>
                </p>
              </td>
            </tr>

          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;

  return {
    subject: 'Please confirm your subscription — Maggi May Broussard',
    html,
  };
}

async function sendConfirmationEmail(toEmail: string, confirmUrl: string): Promise<void> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey || resendApiKey === 'your-resend-api-key-here') {
    console.warn('RESEND_API_KEY not configured — skipping confirmation email');
    return;
  }

  const { subject, html } = buildConfirmationEmail(toEmail, confirmUrl);

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Maggi May Broussard <maggimay@broussardlegalservices.com>',
      to: [toEmail],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    console.error('Resend confirmation email error:', err);
    throw new Error('Failed to send confirmation email');
  }
}

// ─── Crypto helper (Edge-runtime compatible) ─────────────────────────────────

async function generateToken(): Promise<string> {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Rate limit: 3 opt-ins / 10 min per IP ───────────────────────────────
  const ip = getClientIp(req);
  const rl = checkRateLimit(`email-optin:${ip}`, { limit: 3, windowMs: 10 * 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a few minutes before trying again.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      }
    );
  }
  // ────────────────────────────────────────────────────────────────────────

  try {
    const body = await req.json();

    // ── Input validation & sanitization ─────────────────────────────────
    const validation = validateEmailOptIn(body);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const normalizedEmail = validation.email;
    const leadMagnet = typeof body.leadMagnet === 'string' ? body.leadMagnet.slice(0, 100) : '';
    // ────────────────────────────────────────────────────────────────────

    // Check if subscriber already exists and is confirmed
    const { data: existing } = await supabase
      .from('email_subscribers')
      .select('id, confirmed, nurture_enrolled_at')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existing?.confirmed) {
      return NextResponse.json({ success: true, alreadyConfirmed: true });
    }

    // Generate a fresh confirmation token
    const token = await generateToken();
    const confirmUrl = `${SITE_URL}/api/confirm-email?token=${token}`;

    // Upsert subscriber with pending confirmation state
    const { data: subscriber, error } = await supabase
      .from('email_subscribers')
      .upsert(
        {
          email: normalizedEmail,
          subscribed_at: new Date().toISOString(),
          source: leadMagnet === 'paralegal-checklist' ? 'lead_magnet_checklist' : 'website_optin',
          confirmation_token: token,
          confirmed: false,
          confirmation_sent_at: new Date().toISOString(),
        },
        { onConflict: 'email', ignoreDuplicates: false }
      )
      .select('id')
      .single();

    if (error) {
      console.error('Supabase email opt-in error:', error);
      return NextResponse.json({ error: 'Failed to save your email. Please try again.' }, { status: 500 });
    }

    // Send double opt-in confirmation email
    try {
      await sendConfirmationEmail(normalizedEmail, confirmUrl);
    } catch (emailErr) {
      console.error('Confirmation email delivery failed:', emailErr);
    }

    return NextResponse.json({ success: true, pendingConfirmation: true });
  } catch (err) {
    console.error('Email opt-in route error:', err);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
