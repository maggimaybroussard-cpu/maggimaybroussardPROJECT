import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? '';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://broussardlegalservices.com';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'maggimaybroussard@gmail.com';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, signerName, signerEmail, signatureData, signatureType } = body as {
      token: string;
      signerName: string;
      signerEmail: string;
      signatureData: string;
      signatureType: 'typed' | 'drawn';
    };

    if (!token || !signerName || !signatureData) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = await createClient();

    // Fetch the letter
    const { data: letter, error: fetchError } = await supabase
      .from('engagement_letters')
      .select('id, client_name, client_email, status, expires_at')
      .eq('token', token)
      .maybeSingle();

    if (fetchError || !letter) {
      return NextResponse.json({ error: 'Engagement letter not found' }, { status: 404 });
    }

    if (letter.status === 'signed') {
      return NextResponse.json({ error: 'This letter has already been signed', alreadySigned: true }, { status: 409 });
    }

    if (letter.expires_at && new Date(letter.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This engagement letter has expired', expired: true }, { status: 410 });
    }

    // Get IP address
    const ipAddress =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('x-real-ip') ??
      'unknown';

    // Save signature
    const { error: updateError } = await supabase
      .from('engagement_letters')
      .update({
        status: 'signed',
        signed_at: new Date().toISOString(),
        signer_name: signerName,
        signer_email: signerEmail,
        signature_data: signatureData,
        signature_type: signatureType ?? 'typed',
        ip_address: ipAddress,
        updated_at: new Date().toISOString(),
      })
      .eq('token', token);

    if (updateError) {
      console.error('[engagement-letter/sign] Update error:', updateError);
      return NextResponse.json({ error: 'Failed to save signature' }, { status: 500 });
    }

    const signedDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Send confirmation email to client
    if (RESEND_API_KEY && RESEND_API_KEY !== 'your-resend-api-key-here' && signerEmail) {
      const clientHtml = `
        <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:32px 24px;background:#FAF7F2;border-radius:12px;border:1px solid #D9D0C5;">
          <div style="text-align:center;margin-bottom:28px;">
            <div style="width:60px;height:60px;background:rgba(53,94,59,0.1);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;">
              <span style="font-size:28px;">✓</span>
            </div>
            <h1 style="font-size:24px;color:#2C1F14;margin:0 0 8px;font-weight:normal;">Engagement Letter Signed</h1>
            <p style="color:#7A6B5D;font-size:14px;margin:0;">Your engagement with Broussard Legal Services is now official.</p>
          </div>
          <div style="background:#fff;border-radius:10px;padding:24px;border:1px solid #EDE8E0;margin-bottom:24px;">
            <p style="font-size:14px;color:#4A3728;margin:0 0 12px;">Dear ${signerName},</p>
            <p style="font-size:14px;color:#4A3728;line-height:1.7;margin:0 0 12px;">
              This confirms that you have successfully signed your engagement letter on <strong>${signedDate}</strong>.
            </p>
            <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:16px;">
              <tr><td style="padding:8px 0;color:#7A6B5D;border-bottom:1px solid #EDE8E0;width:40%;">Signed By</td><td style="padding:8px 0;color:#2C1F14;border-bottom:1px solid #EDE8E0;">${signerName}</td></tr>
              <tr><td style="padding:8px 0;color:#7A6B5D;border-bottom:1px solid #EDE8E0;">Email</td><td style="padding:8px 0;color:#2C1F14;border-bottom:1px solid #EDE8E0;">${signerEmail}</td></tr>
              <tr><td style="padding:8px 0;color:#7A6B5D;border-bottom:1px solid #EDE8E0;">Date</td><td style="padding:8px 0;color:#2C1F14;border-bottom:1px solid #EDE8E0;">${signedDate}</td></tr>
              <tr><td style="padding:8px 0;color:#7A6B5D;">Signature Method</td><td style="padding:8px 0;color:#2C1F14;">${signatureType === 'drawn' ? 'Hand-drawn signature' : 'Typed signature'}</td></tr>
            </table>
          </div>
          <div style="text-align:center;margin-bottom:24px;">
            <a href="${SITE_URL}/portal/login" style="display:inline-block;background:#355E3B;color:#fff;text-decoration:none;padding:12px 28px;border-radius:50px;font-size:13px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;">
              Access Client Portal
            </a>
          </div>
          <p style="font-size:12px;color:#7A6B5D;text-align:center;margin:0;">
            Broussard Legal Services · <a href="${SITE_URL}" style="color:#C8965A;">${SITE_URL}</a>
          </p>
        </div>
      `;

      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: 'maggimay@broussardlegalservices.com',
            to: [signerEmail],
            subject: `✅ Engagement Letter Signed — Broussard Legal Services`,
            html: clientHtml,
          }),
        });
      } catch { /* non-blocking */ }
    }

    // Notify admin
    if (RESEND_API_KEY && RESEND_API_KEY !== 'your-resend-api-key-here') {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: 'maggimay@broussardlegalservices.com',
            to: [ADMIN_EMAIL],
            subject: `✅ Engagement Letter Signed — ${signerName}`,
            html: `<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:24px;background:#FAF7F2;border-radius:10px;border:1px solid #D9D0C5;">
              <h2 style="color:#4A3728;margin:0 0 16px;">✅ Engagement Letter Signed</h2>
              <table style="width:100%;border-collapse:collapse;font-size:14px;">
                <tr><td style="padding:8px 0;color:#7A6B5D;border-bottom:1px solid #EDE8E0;width:40%;">Client</td><td style="padding:8px 0;color:#2C1F14;border-bottom:1px solid #EDE8E0;">${signerName}</td></tr>
                <tr><td style="padding:8px 0;color:#7A6B5D;border-bottom:1px solid #EDE8E0;">Email</td><td style="padding:8px 0;color:#2C1F14;border-bottom:1px solid #EDE8E0;">${signerEmail}</td></tr>
                <tr><td style="padding:8px 0;color:#7A6B5D;border-bottom:1px solid #EDE8E0;">Date</td><td style="padding:8px 0;color:#2C1F14;border-bottom:1px solid #EDE8E0;">${signedDate}</td></tr>
                <tr><td style="padding:8px 0;color:#7A6B5D;">IP Address</td><td style="padding:8px 0;color:#7A6B5D;font-size:12px;font-family:monospace;">${ipAddress}</td></tr>
              </table>
              <p style="margin:20px 0 0;font-size:13px;color:#7A6B5D;">View in <a href="${SITE_URL}/admin" style="color:#C8965A;">admin dashboard</a> under Engagement Letters.</p>
            </div>`,
          }),
        });
      } catch { /* non-blocking */ }
    }

    return NextResponse.json({ success: true, signedAt: new Date().toISOString() });
  } catch (err) {
    console.error('[engagement-letter/sign] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to sign engagement letter' },
      { status: 500 }
    );
  }
}
