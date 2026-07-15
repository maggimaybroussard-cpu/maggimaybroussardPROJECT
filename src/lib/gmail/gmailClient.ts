/**
 * Gmail API client for sending transactional emails via Google Workspace.
 * Uses the same OAuth tokens stored in google_calendar_tokens for Calendar.
 * Sends emails through the Gmail API using the authenticated Google account.
 */

import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Refresh and return a valid Google OAuth access token.
 * Reuses the same token row used by Google Calendar.
 */
async function getGmailAccessToken(): Promise<{ accessToken: string; senderEmail: string } | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (
    !clientId || clientId === 'your-google-client-id-here' ||
    !clientSecret || clientSecret === 'your-google-client-secret-here'
  ) {
    return null;
  }

  const supabase = getServiceClient();
  const { data: tokenRow } = await supabase
    .from('google_calendar_tokens')
    .select('*')
    .limit(1)
    .single();

  if (!tokenRow?.refresh_token) return null;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokenRow.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) return null;

  // Derive sender email from token row or env
  const senderEmail =
    tokenRow.email ||
    tokenRow.account_email ||
    process.env.GMAIL_SENDER_EMAIL ||
    'broussardlegalservices@gmail.com';

  return { accessToken: tokenData.access_token, senderEmail };
}

/**
 * Encode an email message as RFC 2822 base64url for the Gmail API.
 */
function buildRawEmail(params: {
  from: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}): string {
  const boundary = `boundary_${Date.now().toString(36)}`;
  const lines = [
    `From: ${params.from}`,
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    params.replyTo ? `Reply-To: ${params.replyTo}` : null,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    params.html,
    '',
    `--${boundary}--`,
  ]
    .filter((l) => l !== null)
    .join('\r\n');

  // base64url encode
  return Buffer.from(lines)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export interface GmailSendParams {
  to: string;
  subject: string;
  html: string;
  fromName?: string;
  replyTo?: string;
}

export interface GmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  /** true when Gmail was unavailable and Resend fallback was used */
  usedFallback?: boolean;
}

/**
 * Send a transactional email via Gmail API (Google Workspace).
 * Falls back to Resend if Gmail credentials are not configured.
 */
export async function sendGmailEmail(params: GmailSendParams): Promise<GmailSendResult> {
  const auth = await getGmailAccessToken();

  if (!auth) {
    // Fallback to Resend
    return sendViaResendFallback(params);
  }

  const fromLabel = params.fromName
    ? `${params.fromName} <${auth.senderEmail}>`
    : `Broussard Legal Services <${auth.senderEmail}>`;

  const raw = buildRawEmail({
    from: fromLabel,
    to: params.to,
    subject: params.subject,
    html: params.html,
    replyTo: params.replyTo ?? auth.senderEmail,
  });

  try {
    const res = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw }),
      }
    );

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const errMsg = (errBody as { error?: { message?: string } })?.error?.message ?? `Gmail API ${res.status}`;

      // If Gmail fails, fall back to Resend
      console.warn('[gmailClient] Gmail send failed, falling back to Resend:', errMsg);
      return sendViaResendFallback(params);
    }

    const data = await res.json();
    return { success: true, messageId: data.id };
  } catch (err) {
    console.warn('[gmailClient] Gmail send exception, falling back to Resend:', err);
    return sendViaResendFallback(params);
  }
}

/**
 * Resend fallback — used when Gmail OAuth is not yet configured or fails.
 */
async function sendViaResendFallback(params: GmailSendParams): Promise<GmailSendResult> {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY || RESEND_API_KEY === 'your-resend-api-key-here') {
    return { success: false, error: 'Neither Gmail nor Resend is configured' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: [params.to],
        subject: params.subject,
        html: params.html,
      }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      return {
        success: false,
        error: (errBody as { message?: string }).message ?? `Resend ${res.status}`,
        usedFallback: true,
      };
    }

    const data = await res.json();
    return { success: true, messageId: data.id, usedFallback: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Resend fallback failed',
      usedFallback: true,
    };
  }
}
