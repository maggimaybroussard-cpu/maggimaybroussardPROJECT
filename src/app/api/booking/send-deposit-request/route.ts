import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      clientName,
      clientEmail,
      eventName,
      startTime,
      timezone,
      bookingId,
    } = body as {
      clientName: string;
      clientEmail: string;
      eventName: string;
      startTime?: string;
      timezone?: string;
      bookingId?: string;
    };

    if (!clientEmail || !clientName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY || RESEND_API_KEY === 'your-resend-api-key-here') {
      return NextResponse.json({ sent: false, reason: 'Resend not configured' });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://broussardlegalservices.com';

    // Build the deposit payment URL with pre-filled params
    const depositParams = new URLSearchParams({
      name: clientName,
      email: clientEmail,
      event: eventName || 'Consultation',
      ...(startTime ? { start: startTime } : {}),
      ...(bookingId ? { booking_id: bookingId } : {}),
    });
    const depositUrl = `${siteUrl}/retainer-deposit?${depositParams.toString()}`;

    // Format the appointment time
    let formattedTime = 'Your scheduled time';
    if (startTime) {
      try {
        formattedTime = new Date(startTime).toLocaleString('en-US', {
          timeZone: timezone ?? 'America/Chicago',
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZoneName: 'short',
        });
      } catch {
        formattedTime = startTime;
      }
    }

    const firstName = clientName.split(' ')[0] || clientName;

    const html = `
      <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:32px;background:#f9f7f4;border-radius:8px;">
        <div style="background:#fff;border-radius:8px;padding:40px;border:1px solid #e5e7eb;">

          <!-- Header -->
          <div style="text-align:center;margin-bottom:32px;">
            <div style="width:56px;height:56px;background:rgba(53,94,59,0.1);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;">
              <span style="font-size:24px;">⚖️</span>
            </div>
            <h1 style="font-family:Georgia,serif;font-size:24px;color:#1a1a1a;margin:0 0 8px;">
              Booking Confirmed — One Step Remaining
            </h1>
            <p style="color:#6b7280;font-size:14px;margin:0;">
              Broussard Legal Services
            </p>
          </div>

          <!-- Greeting -->
          <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">
            Dear ${firstName},
          </p>
          <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 24px;">
            Your <strong>${eventName || 'consultation'}</strong> has been successfully scheduled for <strong>${formattedTime}</strong>. 
            To confirm your engagement and lock in your time slot, a <strong>$250 retainer deposit</strong> is required before we begin.
          </p>

          <!-- Deposit info box -->
          <div style="background:rgba(53,94,59,0.05);border:1px solid rgba(53,94,59,0.2);border-radius:12px;padding:20px 24px;margin:0 0 28px;">
            <p style="font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#355E3B;margin:0 0 12px;">
              About Your Deposit
            </p>
            <ul style="margin:0;padding:0 0 0 16px;color:#374151;font-size:14px;line-height:1.8;">
              <li>Applied 100% toward your first invoice — no extra charge</li>
              <li>Fully refundable if the engagement does not proceed</li>
              <li>Secures your consultation time slot immediately</li>
              <li>Triggers your onboarding welcome sequence</li>
            </ul>
          </div>

          <!-- CTA button -->
          <div style="text-align:center;margin:0 0 32px;">
            <a
              href="${depositUrl}"
              style="display:inline-block;background:#355E3B;color:#fff;text-decoration:none;padding:16px 40px;border-radius:50px;font-size:14px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;"
            >
              Pay $250 Deposit Now →
            </a>
            <p style="color:#9ca3af;font-size:12px;margin:12px 0 0;">
              Secured by Stripe · SSL encrypted
            </p>
          </div>

          <!-- Appointment summary -->
          <div style="border-top:1px solid #e5e7eb;padding-top:24px;margin-bottom:24px;">
            <p style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;margin:0 0 12px;">
              Your Appointment
            </p>
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:6px 0;font-size:13px;color:#6b7280;width:40%;">Consultation</td>
                <td style="padding:6px 0;font-size:13px;color:#1a1a1a;font-weight:500;">${eventName || 'Consultation'}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:13px;color:#6b7280;">Scheduled</td>
                <td style="padding:6px 0;font-size:13px;color:#1a1a1a;font-weight:500;">${formattedTime}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:13px;color:#6b7280;">Deposit</td>
                <td style="padding:6px 0;font-size:13px;color:#355E3B;font-weight:600;">$250 USD</td>
              </tr>
            </table>
          </div>

          <!-- Footer note -->
          <p style="color:#9ca3af;font-size:12px;line-height:1.6;margin:0;border-top:1px solid #e5e7eb;padding-top:20px;">
            Questions? Reply to this email or contact us at 
            <a href="mailto:broussardlegalservices@gmail.com" style="color:#355E3B;">broussardlegalservices@gmail.com</a>. 
            If you did not book this consultation, please disregard this email.
          </p>
        </div>
      </div>
    `;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Broussard Legal Services <onboarding@resend.dev>',
        to: [clientEmail],
        subject: `Action Required: $250 Deposit to Confirm Your ${eventName || 'Consultation'}`,
        html,
      }),
    });

    if (!resendRes.ok) {
      const errData = await resendRes.json().catch(() => ({}));
      console.error('[send-deposit-request] Resend error:', errData);
      return NextResponse.json({ sent: false, error: 'Email delivery failed' }, { status: 500 });
    }

    return NextResponse.json({ sent: true });
  } catch (err) {
    console.error('[send-deposit-request] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to send deposit request' },
      { status: 500 }
    );
  }
}
