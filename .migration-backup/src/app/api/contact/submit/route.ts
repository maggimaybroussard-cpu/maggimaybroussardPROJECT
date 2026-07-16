import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://broussardlegalservices.com';
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const GA_API_SECRET = process.env.GA_API_SECRET; // optional server-side secret

// ── GA4 Measurement Protocol helper ─────────────────────────────────────────
async function sendGA4Event(
  eventName: string,
  params: Record<string, unknown>,
  clientId = 'server-side'
) {
  if (!GA_MEASUREMENT_ID) return;
  try {
    const url = `https://www.google-analytics.com/mp/collect?measurement_id=${GA_MEASUREMENT_ID}${GA_API_SECRET ? `&api_secret=${GA_API_SECRET}` : ''}`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        events: [{ name: eventName, params }],
      }),
    });
  } catch {
    // non-blocking — analytics failure must never break the form
  }
}

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

function buildInternalEmail(name: string, firm: string, email: string, service: string, message: string, retainerTier: string, inquiryId: string | null) {
  const tierLabel = retainerTier ? ` · ${retainerTier.charAt(0).toUpperCase() + retainerTier.slice(1)} Tier` : '';
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0; padding:0; background-color:#EDE8E0; font-family:Georgia,serif;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#EDE8E0; padding:40px 16px;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px; width:100%; background-color:${brand.bg}; border-radius:14px; overflow:hidden; border:1px solid ${brand.border}; box-shadow: 0 4px 24px rgba(74,55,40,0.10);">
            <tr><td style="background-color:${brand.primary}; padding:0;">${headerHtml}</td></tr>
            <tr>
              <td style="padding:32px 36px 0;">
                <span style="display:inline-block; background-color:${brand.accent}; color:${brand.white}; font-size:10px; font-weight:bold; letter-spacing:0.12em; text-transform:uppercase; padding:4px 14px; border-radius:20px; margin-bottom:22px; font-family: Georgia, serif;">&#128276; New Lead${tierLabel}</span>
                <h2 style="margin:0 0 20px; font-size:21px; color:${brand.foreground}; font-family: Georgia, serif; font-weight:normal; border-bottom:1px solid ${brand.border}; padding-bottom:14px;">New Contact Inquiry</h2>
              </td>
            </tr>
            <tr>
              <td style="padding:0 36px 32px;">
                <div style="background-color:${brand.bgCard}; border:1px solid ${brand.border}; border-radius:10px; overflow:hidden; margin:0 0 20px;">
                  <div style="background-color:${brand.primary}; padding:10px 22px;">
                    <p style="margin:0; font-size:11px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.12em; font-family: Georgia, serif;">Lead Details</p>
                  </div>
                  <div style="padding:20px 22px;">
                    <table style="width:100%; border-collapse:collapse; font-family:Georgia,serif;">
                      <tr>
                        <td style="padding:8px 0; color:${brand.muted}; font-size:13px; width:38%; border-bottom:1px solid rgba(217,208,197,0.5);">Name</td>
                        <td style="padding:8px 0; color:${brand.foreground}; font-size:14px; font-weight:bold; border-bottom:1px solid rgba(217,208,197,0.5);">${name}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0; color:${brand.muted}; font-size:13px; border-bottom:1px solid rgba(217,208,197,0.5);">Firm</td>
                        <td style="padding:8px 0; color:${brand.foreground}; font-size:14px; border-bottom:1px solid rgba(217,208,197,0.5);">${firm}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0; color:${brand.muted}; font-size:13px; border-bottom:1px solid rgba(217,208,197,0.5);">Email</td>
                        <td style="padding:8px 0; border-bottom:1px solid rgba(217,208,197,0.5);"><a href="mailto:${email}" style="color:${brand.accent}; text-decoration:none; font-size:14px; font-family:Georgia,serif;">${email}</a></td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0; color:${brand.muted}; font-size:13px; border-bottom:1px solid rgba(217,208,197,0.5);">Service</td>
                        <td style="padding:8px 0; color:${brand.foreground}; font-size:14px; font-weight:bold; border-bottom:1px solid rgba(217,208,197,0.5);">${service}</td>
                      </tr>
                      ${retainerTier ? `<tr>
                        <td style="padding:8px 0; color:${brand.muted}; font-size:13px; border-bottom:1px solid rgba(217,208,197,0.5);">Retainer Interest</td>
                        <td style="padding:8px 0; color:${brand.accent}; font-size:14px; font-weight:bold; border-bottom:1px solid rgba(217,208,197,0.5);">${retainerTier.charAt(0).toUpperCase() + retainerTier.slice(1)} Tier</td>
                      </tr>` : ''}
                      <tr>
                        <td style="padding:8px 0; color:${brand.muted}; font-size:13px; vertical-align:top;">Message</td>
                        <td style="padding:8px 0; color:${brand.foreground}; font-size:14px; line-height:1.7;">${message.replace(/\n/g, '<br/>')}</td>
                      </tr>
                    </table>
                  </div>
                </div>
                <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 20px;">
                  <tr>
                    <td style="background-color:${brand.accent}; border-radius:7px; box-shadow: 0 2px 8px rgba(200,150,90,0.25);">
                      <a href="mailto:${email}?subject=Re: Your ${service} Inquiry" style="display:inline-block; padding:13px 28px; color:${brand.white}; text-decoration:none; font-size:13px; font-family:Georgia,serif; letter-spacing:0.05em; font-weight:bold;">Reply to ${name} &rarr;</a>
                    </td>
                  </tr>
                </table>
                ${inquiryId ? `<p style="margin:0; font-size:11px; color:${brand.muted}; font-family:Georgia,serif;">Inquiry ID: ${inquiryId} &nbsp;&middot;&nbsp; Stored in Supabase contact_inquiries</p>` : ''}
              </td>
            </tr>
            <tr>
              <td style="background-color:${brand.secondary}; padding:20px 36px; border-top:1px solid ${brand.border};">
                <p style="margin:0; font-size:11px; color:${brand.muted}; font-family:Georgia,serif;">Sent via maggimay.com contact form</p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;
}

function buildConfirmationEmail(name: string, firm: string, service: string, retainerTier: string) {
  const firstName = name.split(' ')[0];
  const tierNote = retainerTier && retainerTier !== 'project'
    ? `<p style="margin:0 0 16px; font-size:14px; color:${brand.accent}; font-family:Georgia,serif; font-weight:bold;">You expressed interest in the ${retainerTier.charAt(0).toUpperCase() + retainerTier.slice(1)} Retainer — I'll make sure to address that in my response.</p>`
    : '';

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Inquiry Received — Maggi May Broussard</title>
      <!--[if !mso]><!-->
      <div style="display:none;font-size:1px;color:#fefefe;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
        Thank you for reaching out about ${service}. I'll be in touch within one business day.
      </div>
      <!--<![endif]-->
    </head>
    <body style="margin:0; padding:0; background-color:#EDE8E0; font-family:Georgia,'Times New Roman',serif;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#EDE8E0; padding:40px 16px;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px; width:100%; background-color:${brand.bg}; border-radius:14px; overflow:hidden; border:1px solid ${brand.border}; box-shadow: 0 4px 24px rgba(74,55,40,0.10);">
            <tr><td style="background-color:${brand.primary}; padding:0;">${headerHtml}</td></tr>
            <tr>
              <td style="padding:32px 36px 0;">
                <span style="display:inline-block; background-color:${brand.accent}; color:${brand.white}; font-size:10px; font-weight:bold; letter-spacing:0.12em; text-transform:uppercase; padding:4px 14px; border-radius:20px; margin-bottom:22px; font-family: Georgia, serif;">&#10003;&nbsp; Inquiry Received</span>
                <h2 style="margin:0 0 20px; font-size:21px; color:${brand.foreground}; font-family: Georgia, serif; font-weight:normal; border-bottom:1px solid ${brand.border}; padding-bottom:14px;">Thank You, ${firstName}</h2>
              </td>
            </tr>
            <tr>
              <td style="padding:0 36px 32px;">
                <p style="margin:0 0 16px; font-size:15px; color:${brand.foreground}; line-height:1.8; font-family:Georgia,serif;">
                  Your inquiry has been received and I'll personally follow up within one business day. Here's a summary of what you submitted:
                </p>
                ${tierNote}
                <div style="background-color:${brand.bgCard}; border:1px solid ${brand.border}; border-radius:10px; overflow:hidden; margin:0 0 24px;">
                  <div style="background-color:${brand.primary}; padding:10px 22px;">
                    <p style="margin:0; font-size:11px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.12em; font-family: Georgia, serif;">Your Inquiry Summary</p>
                  </div>
                  <div style="padding:20px 22px;">
                    <table style="width:100%; border-collapse:collapse; font-family:Georgia,serif;">
                      <tr>
                        <td style="padding:8px 0; color:${brand.muted}; font-size:13px; width:40%; border-bottom:1px solid rgba(217,208,197,0.5);">Service Requested</td>
                        <td style="padding:8px 0; color:${brand.foreground}; font-size:14px; font-weight:bold; border-bottom:1px solid rgba(217,208,197,0.5);">${service}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0; color:${brand.muted}; font-size:13px; border-bottom:1px solid rgba(217,208,197,0.5);">Firm / Company</td>
                        <td style="padding:8px 0; color:${brand.foreground}; font-size:14px; border-bottom:1px solid rgba(217,208,197,0.5);">${firm}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0; color:${brand.muted}; font-size:13px;">Expected Response</td>
                        <td style="padding:8px 0; color:${brand.foreground}; font-size:14px; font-weight:bold;">Within 1 business day</td>
                      </tr>
                    </table>
                  </div>
                </div>
                <p style="margin:0 0 20px; font-size:15px; color:${brand.foreground}; line-height:1.8; font-family:Georgia,serif;">
                  Don't want to wait? You can book a free 30-minute consultation directly on my calendar.
                </p>
                <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 16px;">
                  <tr>
                    <td style="background-color:${brand.accent}; border-radius:7px; box-shadow: 0 2px 8px rgba(200,150,90,0.25);">
                      <a href="${SITE_URL}/availability" style="display:inline-block; padding:14px 36px; color:${brand.white}; text-decoration:none; font-size:14px; font-family:Georgia,serif; letter-spacing:0.05em; font-weight:bold;">Book a Free Consultation &rarr;</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 28px; font-size:13px; font-family:Georgia,serif;">
                  <a href="${SITE_URL}/services" style="color:${brand.accent}; text-decoration:underline;">Explore my services first &rarr;</a>
                </p>
                <div style="background-color:${brand.accentLight}; border-left:3px solid ${brand.accent}; padding:18px 22px; border-radius:0 8px 8px 0; margin:0 0 28px;">
                  <p style="margin:0 0 10px; font-size:12px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.1em; font-family: Georgia, serif;">What happens next</p>
                  <p style="margin:0 0 8px; font-size:14px; color:${brand.foreground}; line-height:1.7; font-family:Georgia,serif;">&#8594;&nbsp; I'll review your inquiry and reach out within 1 business day</p>
                  <p style="margin:0 0 8px; font-size:14px; color:${brand.foreground}; line-height:1.7; font-family:Georgia,serif;">&#8594;&nbsp; We'll schedule a free consultation to discuss your needs</p>
                  <p style="margin:0; font-size:14px; color:${brand.foreground}; line-height:1.7; font-family:Georgia,serif;">&#8594;&nbsp; I'll propose a tailored engagement plan that fits your workflow</p>
                </div>
                <table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:28px; border-top:1px solid ${brand.border}; padding-top:20px; width:100%;">
                  <tr>
                    <td>
                      <p style="margin:0 0 4px; font-size:15px; color:${brand.foreground}; font-family:Georgia,serif;">Warm regards,</p>
                      <p style="margin:0 0 2px; font-size:16px; color:${brand.primary}; font-weight:bold; font-family:Georgia,serif;">Maggi May Broussard</p>
                      <p style="margin:0 0 6px; font-size:12px; color:${brand.muted}; font-family:Georgia,serif; letter-spacing:0.04em;">Licensed Paralegal · Louisiana &amp; Nationwide</p>
                      <a href="mailto:broussardlegalservices@gmail.com" style="color:${brand.accent}; font-size:13px; text-decoration:none; font-family:Georgia,serif;">broussardlegalservices@gmail.com</a>
                      &nbsp;<span style="color:${brand.border};">|</span>&nbsp;
                      <a href="${SITE_URL}" style="color:${brand.accent}; font-size:13px; text-decoration:none; font-family:Georgia,serif;">maggimay.com</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="background-color:${brand.secondary}; padding:20px 36px; border-top:1px solid ${brand.border};">
                <p style="margin:0; font-size:11px; color:${brand.muted}; font-family:Georgia,serif;">You received this because you submitted a contact form at maggimay.com. If this was a mistake, please disregard this message.</p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;
}

export async function POST(req: NextRequest) {
  // ── Rate limit: 5 contact submissions / 10 min per IP ───────────────────
  const ip = getClientIp(req);
  const rl = checkRateLimit(`contact:${ip}`, { limit: 5, windowMs: 10 * 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many submissions. Please wait a few minutes before trying again.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      }
    );
  }
  // ────────────────────────────────────────────────────────────────────────

  try {
    const body = await req.json();
    const { name, firm, email, service, message, retainerTier, assigned_paralegal, suggested_service } = body;

    if (!name || !firm || !email || !service || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Store in Supabase
    let inquiryId: string | null = null;
    try {
      const supabase = await createClient();
      const { data: inserted, error: dbError } = await supabase
        .from('contact_inquiries')
        .insert({
          name,
          firm,
          email,
          service,
          message,
          notes: message,
          status: 'new',
          booking_stage: 'inquiry',
          assigned_paralegal: assigned_paralegal || null,
          suggested_service: suggested_service || null,
        })
        .select('id')
        .single();

      if (!dbError && inserted?.id) {
        inquiryId = inserted.id;

        // ── GA4 Measurement Protocol: contact form submission ──────────────
        const utmSource = body.utmSource || 'direct';
        await sendGA4Event(
          'contact_form_submission',
          {
            event_category: 'conversion',
            event_label: 'Contact Form Submitted',
            service_type: service,
            lead_source: utmSource,
            retainer_tier: retainerTier || 'none',
            inquiry_id: inquiryId,
            form_id: 'contact_inquiry',
          },
          email // use email as stable client_id proxy
        );
        // ── GA4 Measurement Protocol: workflow funnel step 1 ──────────────
        await sendGA4Event(
          'workflow_lead_created',
          {
            event_category: 'workflow_funnel',
            funnel_step: 1,
            funnel_step_name: 'lead_created',
            lead_source: utmSource,
            service_type: service,
            inquiry_id: inquiryId,
          },
          email
        );
      }
    } catch {
      // Non-blocking — continue even if DB insert fails
    }

    // 2. Send emails via Resend
    if (!RESEND_API_KEY || RESEND_API_KEY === 'your-resend-api-key-here') {
      // No Resend key — still return success if DB insert worked
      return NextResponse.json({
        success: true,
        inquiryId,
        emailSent: false,
        message: 'Inquiry saved. Email delivery requires RESEND_API_KEY.',
      });
    }

    // Send internal notification to Maggi
    const internalRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: ['maggimaybroussard@gmail.com'],
        reply_to: email,
        subject: `🔔 New Inquiry — ${name} · ${service}`,
        html: buildInternalEmail(name, firm, email, service, message, retainerTier || '', inquiryId),
      }),
    });

    if (!internalRes.ok) {
      const errBody = await internalRes.json().catch(() => ({}));
      throw new Error((errBody as any)?.message || 'Failed to send notification email');
    }

    // Send confirmation to visitor (non-blocking)
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: [email],
        subject: 'Your inquiry is received — Maggi May Broussard Legal Services',
        html: buildConfirmationEmail(name, firm, service, retainerTier || ''),
      }),
    }).catch(() => {});

    // Schedule 3-step follow-up sequence (Day 0 confirmation, Day 2 case study, Day 7 offer)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && supabaseServiceKey) {
      fetch(`${supabaseUrl}/functions/v1/schedule-contact-followup-sequence`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          inquiryId,
          recipientEmail: email,
          recipientName: name,
          service,
          source: 'contact_form',
        }),
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, inquiryId, emailSent: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Something went wrong';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
