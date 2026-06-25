import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { to } = body;

    if (!to) {
      return NextResponse.json({ error: 'Missing required field: to' }, { status: 400 });
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY || RESEND_API_KEY === 'your-resend-api-key-here') {
      return NextResponse.json(
        { error: 'RESEND_API_KEY is not configured. Please add your Resend API key in environment settings.' },
        { status: 500 }
      );
    }

    const payload = {
      from: 'Broussard Legal Services <onboarding@resend.dev>',
      to: [to],
      subject: '✅ Resend Integration Test — Broussard Legal Services',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #f9fafb; border-radius: 8px;">
          <div style="background: #fff; border-radius: 8px; padding: 32px; border: 1px solid #e5e7eb;">
            <h2 style="color: #1f2937; margin: 0 0 16px;">✅ Resend Integration is Working</h2>
            <p style="color: #4b5563; margin: 0 0 12px;">This is a test email sent from <strong>Broussard Legal Services</strong> admin panel to verify the Resend email integration is configured correctly.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
            <p style="color: #6b7280; font-size: 14px; margin: 0;">Sent via Resend API · ${new Date().toUTCString()}</p>
          </div>
        </div>
      `,
    };

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || `Resend API error: ${response.status}` },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true, id: data.id, message: `Test email sent to ${to}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
