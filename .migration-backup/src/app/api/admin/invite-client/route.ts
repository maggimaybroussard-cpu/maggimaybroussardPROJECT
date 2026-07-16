import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logAuditEvent } from '@/lib/auditLogger';

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

function buildInviteEmail(clientName: string, portalUrl: string): string {
  const firstName = clientName.split(' ')[0];
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
    <div style="height:20px; background-color:${brand.primary};"></div>
  `;

  const bodyHtml = `
    ${p(`Dear ${firstName},`)}
    ${p(`You've been invited to access your secure client portal with Maggi May Broussard Legal Services. Your portal gives you a private space to:`)}
    <ul style="margin:0 0 16px; padding-left:20px; font-size:15px; color:${brand.foreground}; line-height:2; font-family:Georgia,serif;">
      <li>Track your case status and timeline</li>
      <li>View and download documents</li>
      <li>Review invoices and payment history</li>
      <li>Communicate securely with Maggi</li>
    </ul>
    ${p(`Click the button below to set up your password and access your portal. This link is valid for 24 hours.`)}
    ${cta('Set Up My Portal Access', portalUrl)}
    ${p(`If you have any questions, please reply to this email or reach out directly.`)}
    ${p(`Warm regards,<br/><strong>Maggi May Broussard</strong><br/>Paralegal Services`)}
  `;

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
                <h2 style="margin:0 0 20px; font-size:21px; color:${brand.foreground}; font-family: Georgia, serif; font-weight:normal; border-bottom:1px solid ${brand.border}; padding-bottom:14px;">Your Client Portal Invitation</h2>
              </td>
            </tr>
            <tr>
              <td style="padding:0 36px 32px;">${bodyHtml}</td>
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, name, inquiryId } = body;

    if (!email || !name) {
      return NextResponse.json({ error: 'Missing required fields: email, name' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const resendKey = process.env.RESEND_API_KEY;

    if (!supabaseUrl) {
      return NextResponse.json({ error: 'Supabase URL not configured' }, { status: 503 });
    }

    // Use service role key if available for admin operations, otherwise fall back to anon key
    const supabaseKey = serviceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseKey) {
      return NextResponse.json({ error: 'Supabase key not configured' }, { status: 503 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://broussardlegalservices.com';
    const redirectTo = `${siteUrl}/portal/login`;

    // Invite user via Supabase Auth (sends magic link / invite email from Supabase)
    // We'll also send our own branded email via Resend
    let userId: string | null = null;
    let inviteLink = `${siteUrl}/portal/login`;

    try {
      if (serviceRoleKey) {
        // Admin invite — creates user and returns invite link
        const { data: inviteData, error: inviteError } = await (supabaseAdmin.auth.admin as any).inviteUserByEmail(email, {
          redirectTo,
          data: { full_name: name },
        });
        if (inviteError) {
          // User may already exist — try to look them up
          if (!inviteError.message?.includes('already been registered')) {
            throw inviteError;
          }
        } else {
          userId = inviteData?.user?.id ?? null;
        }
      }
    } catch {
      // Non-fatal — we'll still send the branded email
    }

    // If we have an inquiryId and a userId, link them in client_portal_access
    if (userId && inquiryId) {
      await supabaseAdmin
        .from('client_portal_access')
        .upsert({ user_id: userId, inquiry_id: inquiryId }, { onConflict: 'user_id,inquiry_id' });
    }

    // Send branded invite email via Resend
    if (resendKey && resendKey !== 'your-resend-api-key-here') {
      const html = buildInviteEmail(name, inviteLink);
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: 'maggimay@broussardlegalservices.com',
          to: [email],
          subject: 'Your Client Portal Invitation — Maggi May Broussard',
          html,
        }),
      });

      if (!resendRes.ok) {
        const errBody = await resendRes.json();
        return NextResponse.json(
          { error: `Email send failed: ${errBody.message || 'Resend API error'}` },
          { status: 502 }
        );
      }

      const resendData = await resendRes.json();

      // Audit log the client invite
      logAuditEvent({
        action_type: 'client_invited',
        actor_email: 'admin',
        target_type: 'client',
        target_id: inquiryId ?? userId ?? undefined,
        target_label: name,
        description: `Client portal invitation sent to ${name} (${email})`,
        metadata: { email, inquiry_id: inquiryId, user_id: userId },
      }).catch(() => {});

      return NextResponse.json({ success: true, emailId: resendData.id, userId });
    }

    // Resend not configured — return success with note
    logAuditEvent({
      action_type: 'client_invited',
      actor_email: 'admin',
      target_type: 'client',
      target_id: inquiryId ?? userId ?? undefined,
      target_label: name,
      description: `Client portal account created for ${name} (${email}) — invite email not sent (Resend not configured)`,
      metadata: { email, inquiry_id: inquiryId, user_id: userId },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      userId,
      note: 'RESEND_API_KEY not configured — invite email was not sent. Client account was created in Supabase.',
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to invite client' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Fetch portal access rows joined with inquiry data
    const { data, error } = await supabaseAdmin
      .from('client_portal_access')
      .select(`
        id,
        user_id,
        inquiry_id,
        created_at,
        contact_inquiries (
          name,
          email,
          firm,
          service,
          status
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ clients: data ?? [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch clients' },
      { status: 500 }
    );
  }
}
