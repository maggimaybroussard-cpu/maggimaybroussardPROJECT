import { NextRequest, NextResponse } from 'next/server';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

function formatTranscript(messages: Message[]): string {
  return messages
    .map((m) => {
      const speaker = m.role === 'user' ? 'You' : 'Lexi (AI Legal Assistant)';
      return `${speaker}:\n${m.content}`;
    })
    .join('\n\n---\n\n');
}

function buildEmailHtml(transcript: string, visitorEmail: string): string {
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const rows = transcript
    .split('\n\n---\n\n')
    .map((block) => {
      const [speakerLine, ...rest] = block.split('\n');
      const isUser = speakerLine?.startsWith('You');
      const bgColor = isUser ? '#F0F4FF' : '#FFFFFF';
      const labelColor = isUser ? '#1B2A4A' : '#6B7280';
      return `
        <tr>
          <td style="padding: 12px 16px; background: ${bgColor}; border-bottom: 1px solid #E5E7EB;">
            <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 600; color: ${labelColor}; text-transform: uppercase; letter-spacing: 0.05em;">${speakerLine}</p>
            <p style="margin: 0; font-size: 14px; color: #374151; line-height: 1.6;">${rest.join('\n').replace(/\n/g, '<br/>')}</p>
          </td>
        </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <!-- Header -->
        <tr>
          <td style="background:#1B2A4A;padding:28px 32px;">
            <p style="margin:0;font-size:20px;font-weight:700;color:#FFFFFF;">Broussard Legal Services</p>
            <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.65);">Your Lexi Conversation Transcript</p>
          </td>
        </tr>
        <!-- Date -->
        <tr>
          <td style="padding:16px 32px;background:#F8FAFC;border-bottom:1px solid #E5E7EB;">
            <p style="margin:0;font-size:13px;color:#6B7280;">Conversation on <strong style="color:#374151;">${date}</strong></p>
          </td>
        </tr>
        <!-- Transcript -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:0;">
          ${rows}
        </table>
        <!-- Disclaimer -->
        <tr>
          <td style="padding:20px 32px;background:#FFFBEB;border-top:2px solid #FDE68A;">
            <p style="margin:0;font-size:12px;color:#92400E;line-height:1.5;"><strong>Disclaimer:</strong> Lexi provides general legal information only, not legal advice. This transcript is for your reference. For advice specific to your situation, please consult a licensed attorney.</p>
          </td>
        </tr>
        <!-- CTA -->
        <tr>
          <td style="padding:24px 32px;text-align:center;">
            <p style="margin:0 0 16px;font-size:14px;color:#374151;">Ready to speak with Maggi Broussard directly?</p>
            <a href="https://broussardlegalservices.com/availability" style="display:inline-block;padding:12px 28px;background:#1B2A4A;color:#FFFFFF;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">Book a Free Consultation →</a>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px;background:#F9FAFB;border-top:1px solid #E5E7EB;text-align:center;">
            <p style="margin:0;font-size:11px;color:#9CA3AF;">Broussard Legal Services · New Orleans, LA · broussardlegalservices.com</p>
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
    const { email, messages, visitorId } = await req.json();

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'No conversation to send.' }, { status: 400 });
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey || resendApiKey === 'your-resend-api-key-here') {
      return NextResponse.json({ error: 'Email service not configured.' }, { status: 503 });
    }

    const transcript = formatTranscript(messages);
    const html = buildEmailHtml(transcript, email);

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Broussard Legal Services <lexi@broussardlegalservices.com>',
        to: [email],
        subject: 'Your Lexi Conversation Transcript — Broussard Legal Services',
        html,
      }),
    });

    if (!resendRes.ok) {
      const err = await resendRes.text();
      console.error('[lexi/email-transcript] Resend error:', err);
      return NextResponse.json({ error: 'Failed to send email. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[lexi/email-transcript] Error:', err);
    return NextResponse.json({ error: 'Unexpected error. Please try again.' }, { status: 500 });
  }
}
