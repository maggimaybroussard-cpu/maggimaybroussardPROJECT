import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  if (!token) {
    return new NextResponse(renderPage('Invalid Link', 'This unsubscribe link is invalid or has already been used.', false), {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  try {
    const supabase = await createClient();

    // Find subscriber by token
    const { data: subscriber, error: findErr } = await supabase
      .from('email_subscribers')
      .select('id, email, unsubscribed_at')
      .eq('unsubscribe_token', token)
      .maybeSingle();

    if (findErr || !subscriber) {
      return new NextResponse(renderPage('Invalid Link', 'This unsubscribe link is invalid or has already been used.', false), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    if (subscriber.unsubscribed_at) {
      return new NextResponse(renderPage('Already Unsubscribed', `${subscriber.email} has already been removed from our mailing list.`, true), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // Mark as unsubscribed and clear the token
    const { error: updateErr } = await supabase
      .from('email_subscribers')
      .update({
        unsubscribed_at: new Date().toISOString(),
        unsubscribe_token: null,
      })
      .eq('id', subscriber.id);

    if (updateErr) throw updateErr;

    return new NextResponse(renderPage('Unsubscribed', `${subscriber.email} has been successfully removed from our mailing list. You will no longer receive emails from Maggi May Broussard Legal Services.`, true), {
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new NextResponse(renderPage('Error', `Something went wrong: ${message}. Please try again or reply to any email with "unsubscribe".`, false), {
      headers: { 'Content-Type': 'text/html' },
    });
  }
}

function renderPage(title: string, message: string, success: boolean): string {
  const icon = success ? '✓' : '✗';
  const iconColor = success ? '#355E3B' : '#C8965A';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Maggi May Broussard</title>
</head>
<body style="margin:0;padding:0;background-color:#EDE8E0;font-family:Georgia,'Times New Roman',serif;min-height:100vh;display:flex;align-items:center;justify-content:center;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#EDE8E0;padding:40px 16px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" role="presentation" style="max-width:520px;width:100%;background-color:#FAF7F2;border-radius:14px;overflow:hidden;border:1px solid #D9D0C5;box-shadow:0 4px 24px rgba(74,55,40,0.10);">
        <tr>
          <td style="background-color:#4A3728;padding:0;">
            <div style="height:4px;background:linear-gradient(to right,#C8965A,#E8B87A,#C8965A);"></div>
            <div style="padding:28px 36px 24px;">
              <h1 style="margin:0;font-size:22px;color:#FFFFFF;font-family:Georgia,serif;font-weight:normal;">Maggi May Broussard</h1>
              <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.65);font-family:Georgia,serif;letter-spacing:0.06em;">Legal Services · Louisiana &amp; Nationwide</p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 36px;">
            <div style="text-align:center;margin-bottom:24px;">
              <div style="display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:50%;background-color:${iconColor}22;border:2px solid ${iconColor};font-size:24px;color:${iconColor};">${icon}</div>
            </div>
            <h2 style="margin:0 0 16px;font-size:22px;color:#2C1F14;font-family:Georgia,serif;font-weight:normal;text-align:center;">${title}</h2>
            <p style="margin:0 0 28px;font-size:15px;color:#2C1F14;line-height:1.8;font-family:Georgia,serif;text-align:center;">${message}</p>
            <div style="text-align:center;">
              <a href="https://broussardlegalservices.com" style="display:inline-block;padding:12px 32px;background-color:#C8965A;color:#FFFFFF;text-decoration:none;font-size:14px;font-family:Georgia,serif;border-radius:7px;letter-spacing:0.04em;">Return to Website</a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background-color:#EDE8E0;padding:16px 36px;border-top:1px solid #D9D0C5;">
            <p style="margin:0;font-size:11px;color:#7A6B5D;text-align:center;font-family:Georgia,serif;">
              Maggi May Broussard Legal Services &middot; <a href="mailto:maggimaybroussard@gmail.com" style="color:#C8965A;text-decoration:none;">maggimaybroussard@gmail.com</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
