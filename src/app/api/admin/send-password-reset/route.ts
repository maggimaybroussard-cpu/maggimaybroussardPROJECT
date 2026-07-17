import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
    }

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const RESEND_API_KEY = process.env.RESEND_API_KEY;

    if (!SUPABASE_URL || !RESEND_API_KEY) {
      return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
    }

    // Use the published domain for the redirect URL
    const siteUrl = 'https://broussardlegalservices.com';
    const redirectTo = `${siteUrl}/auth/callback?next=/admin/reset-password`;

    let resetLink: string | null = null;

    // Try admin generateLink first (requires service role key)
    if (SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        const { data, error } = await adminClient.auth.admin.generateLink({
          type: 'recovery',
          email,
          options: { redirectTo },
        });

        if (!error && data?.properties?.action_link) {
          resetLink = data.properties.action_link;
        }
      } catch {
        // Fall through to client-side reset
      }
    }

    // If we have a reset link, send it via Resend
    if (resetLink) {
      const emailPayload = {
        from: 'Broussard Legal Services <onboarding@resend.dev>',
        to: [email],
        subject: 'Reset Your Admin Password — Broussard Legal Services',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #f9fafb;">
            <div style="background: #fff; border-radius: 12px; padding: 40px; border: 1px solid #e5e7eb;">
              <div style="text-align: center; margin-bottom: 32px;">
                <div style="width: 56px; height: 56px; background: #1a1a2e; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
                  <span style="color: white; font-size: 24px;">🔐</span>
                </div>
                <h1 style="color: #1f2937; font-size: 24px; font-weight: 700; margin: 0 0 8px;">Reset Your Password</h1>
                <p style="color: #6b7280; font-size: 15px; margin: 0;">Broussard Legal Services — Admin Portal</p>
              </div>

              <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
                We received a request to reset the password for your admin account. Click the button below to set a new password.
              </p>

              <div style="text-align: center; margin: 32px 0;">
                <a href="${resetLink}"
                   style="display: inline-block; background: #1a1a2e; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px;">
                  Reset My Password
                </a>
              </div>

              <p style="color: #6b7280; font-size: 13px; line-height: 1.6; margin: 24px 0 0;">
                This link expires in <strong>1 hour</strong>. If you didn't request a password reset, you can safely ignore this email — your password will not change.
              </p>

              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />

              <p style="color: #9ca3af; font-size: 12px; margin: 0; text-align: center;">
                If the button doesn't work, copy and paste this link into your browser:<br />
                <a href="${resetLink}" style="color: #6b7280; word-break: break-all;">${resetLink}</a>
              </p>
            </div>
          </div>
        `,
      };

      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailPayload),
      });

      const resendData = await resendResponse.json();

      if (!resendResponse.ok) {
        return NextResponse.json(
          { error: resendData.message || 'Failed to send email. Please try again.' },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true });
    }

    // Fallback: use Supabase client-side reset (relies on Supabase email delivery)
    // This path is taken when service role key is not available
    const { createClient: createBrowserClient } = await import('@supabase/supabase-js');
    const supabase = createBrowserClient(
      SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, fallback: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
