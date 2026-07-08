import { NextRequest, NextResponse } from 'next/server';

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
  blue: '#1D4ED8',
  blueLight: '#EFF6FF',
};

interface FileShareEmailPayload {
  toEmail: string;
  toName: string;
  fileName: string;
  fileDescription?: string;
  caseName?: string;
  caseRef?: string;
  accessUrl?: string;
  expiresAt?: string;
  sharedBy?: string;
  message?: string;
}

function buildFileShareHtml(payload: FileShareEmailPayload): string {
  const firstName = payload.toName.split(' ')[0] || payload.toName;
  const sharedBy = payload.sharedBy || 'Maggi May Broussard';
  const accessUrl = payload.accessUrl || `${SITE_URL}/portal/files`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document Shared — Broussard Legal Services</title>
</head>
<body style="margin:0;padding:0;background-color:${brand.secondary};font-family:Georgia,'Times New Roman',serif;-webkit-text-size-adjust:100%;">
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
                <td style="text-align:right;vertical-align:middle;">
                  <p style="margin:0;font-size:11px;color:${brand.accent};letter-spacing:0.12em;text-transform:uppercase;font-family:Georgia,serif;">Document Shared</p>
                </td>
              </tr>
            </table>
            <div style="height:1px;background:linear-gradient(to right,${brand.accent},rgba(200,150,90,0.2),transparent);margin:0 36px;"></div>
            <div style="height:20px;"></div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 36px 32px;">

            <!-- Badge -->
            <span style="display:inline-block;background-color:${brand.blue};color:${brand.white};font-size:10px;font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;padding:4px 14px;border-radius:20px;margin-bottom:22px;font-family:Georgia,serif;">&#128196; Document Shared With You</span>

            <!-- Heading -->
            <h2 style="margin:0 0 16px;font-size:22px;color:${brand.foreground};font-family:Georgia,'Times New Roman',serif;font-weight:normal;border-bottom:1px solid ${brand.border};padding-bottom:14px;">
              A document has been shared with you, ${firstName}
            </h2>

            <p style="margin:0 0 20px;font-size:15px;color:${brand.foreground};line-height:1.8;font-family:Georgia,serif;">
              ${sharedBy} has shared a document with you through your secure client portal. Please log in to access, review, and download the file.
            </p>

            <!-- File card -->
            <div style="background-color:${brand.bgCard};border:1px solid ${brand.border};border-radius:10px;overflow:hidden;margin:0 0 24px;">
              <div style="background-color:${brand.primary};padding:12px 22px;">
                <p style="margin:0;font-size:11px;color:${brand.accent};font-weight:bold;text-transform:uppercase;letter-spacing:0.12em;font-family:Georgia,serif;">&#128196; File Details</p>
              </div>
              <div style="padding:20px 22px;">
                <table style="width:100%;border-collapse:collapse;font-family:Georgia,serif;">
                  <tr>
                    <td style="padding:8px 0;color:${brand.muted};font-size:13px;width:40%;border-bottom:1px solid rgba(217,208,197,0.5);">File Name</td>
                    <td style="padding:8px 0;color:${brand.foreground};font-size:14px;font-weight:bold;border-bottom:1px solid rgba(217,208,197,0.5);">${payload.fileName}</td>
                  </tr>
                  ${payload.fileDescription ? `
                  <tr>
                    <td style="padding:8px 0;color:${brand.muted};font-size:13px;width:40%;border-bottom:1px solid rgba(217,208,197,0.5);">Description</td>
                    <td style="padding:8px 0;color:${brand.foreground};font-size:14px;border-bottom:1px solid rgba(217,208,197,0.5);">${payload.fileDescription}</td>
                  </tr>` : ''}
                  ${payload.caseName ? `
                  <tr>
                    <td style="padding:8px 0;color:${brand.muted};font-size:13px;width:40%;border-bottom:1px solid rgba(217,208,197,0.5);">Case</td>
                    <td style="padding:8px 0;color:${brand.foreground};font-size:14px;border-bottom:1px solid rgba(217,208,197,0.5);">${payload.caseName}${payload.caseRef ? ` <span style="color:${brand.muted};font-size:12px;">(#${payload.caseRef})</span>` : ''}</td>
                  </tr>` : ''}
                  <tr>
                    <td style="padding:8px 0;color:${brand.muted};font-size:13px;width:40%;${payload.expiresAt ? 'border-bottom:1px solid rgba(217,208,197,0.5);' : ''}">Shared By</td>
                    <td style="padding:8px 0;color:${brand.foreground};font-size:14px;${payload.expiresAt ? 'border-bottom:1px solid rgba(217,208,197,0.5);' : ''}">${sharedBy}</td>
                  </tr>
                  ${payload.expiresAt ? `
                  <tr>
                    <td style="padding:8px 0;color:${brand.muted};font-size:13px;width:40%;">Access Expires</td>
                    <td style="padding:8px 0;color:#B45309;font-size:14px;font-weight:bold;">${payload.expiresAt}</td>
                  </tr>` : ''}
                </table>
              </div>
            </div>

            ${payload.message ? `
            <!-- Custom message -->
            <div style="background-color:${brand.accentLight};border:1px solid rgba(200,150,90,0.35);border-radius:10px;padding:20px 24px;margin:0 0 24px;">
              <p style="margin:0 0 8px;font-size:11px;color:${brand.accent};font-weight:bold;text-transform:uppercase;letter-spacing:0.12em;font-family:Georgia,serif;">Note from ${sharedBy}</p>
              <p style="margin:0;font-size:13px;color:${brand.foreground};line-height:1.7;font-family:Georgia,serif;">${payload.message}</p>
            </div>` : ''}

            <!-- Security notice -->
            <div style="background-color:${brand.blueLight};border-left:3px solid ${brand.blue};padding:14px 18px;border-radius:0 8px 8px 0;margin:0 0 24px;">
              <p style="margin:0;font-size:13px;color:#1e40af;line-height:1.7;font-family:Georgia,serif;">
                &#128274; This document is shared securely through your client portal. Do not forward this email. Access is restricted to your account only.
              </p>
            </div>

            <!-- CTA -->
            <table cellpadding="0" cellspacing="0" role="presentation" style="margin:24px 0;">
              <tr>
                <td style="background-color:${brand.blue};border-radius:7px;box-shadow:0 2px 8px rgba(29,78,216,0.25);">
                  <a href="${accessUrl}" style="display:inline-block;padding:14px 36px;color:${brand.white};text-decoration:none;font-size:14px;font-family:Georgia,serif;letter-spacing:0.05em;font-weight:bold;">Access Document &rarr;</a>
                </td>
              </tr>
            </table>

            <!-- Signature -->
            <table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:28px;border-top:1px solid ${brand.border};padding-top:20px;width:100%;">
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

        <!-- Footer -->
        <tr>
          <td style="background-color:${brand.secondary};padding:20px 36px;border-top:1px solid ${brand.border};">
            <p style="margin:0 0 4px;font-size:12px;color:${brand.primary};font-weight:bold;font-family:Georgia,serif;letter-spacing:0.04em;">Maggi May Broussard Legal Services</p>
            <p style="margin:0;font-size:11px;color:${brand.muted};line-height:1.7;font-family:Georgia,serif;">
              You received this because you have an active matter with Broussard Legal Services.
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

export async function POST(req: NextRequest) {
  try {
    const body: FileShareEmailPayload = await req.json();

    const { toEmail, toName, fileName } = body;

    if (!toEmail || !toName || !fileName) {
      return NextResponse.json(
        { error: 'Missing required fields: toEmail, toName, fileName' },
        { status: 400 }
      );
    }

    if (!RESEND_API_KEY || RESEND_API_KEY === 'your-resend-api-key-here') {
      return NextResponse.json(
        { error: 'RESEND_API_KEY is not configured.' },
        { status: 503 }
      );
    }

    const html = buildFileShareHtml(body);
    const subject = `Document Shared: ${fileName} — Broussard Legal Services`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: [toEmail],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody?.message || `Resend API error: ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json({ success: true, emailId: data.id, subject });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to send file share email' },
      { status: 500 }
    );
  }
}
