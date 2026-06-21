import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      },
    });
  }

  try {
    const { name, email, service, date, time, caseSummary, firm, budget } = await req.json();

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not set");

    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8" /><title>Booking Confirmation</title></head>
      <body style="font-family: Georgia, serif; background: #F9F0EC; margin: 0; padding: 0;">
        <div style="max-width: 600px; margin: 40px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
          <div style="background: linear-gradient(135deg, #2d5a35 0%, #355E3B 100%); padding: 40px 40px 32px; text-align: center;">
            <h1 style="color: #fff; font-size: 28px; margin: 0 0 8px; font-family: Georgia, serif;">Booking Confirmed</h1>
            <p style="color: rgba(255,255,255,0.8); font-size: 15px; margin: 0;">Broussard Legal Services</p>
          </div>
          <div style="padding: 40px;">
            <p style="color: #1B2A4A; font-size: 16px; margin: 0 0 24px;">Hi ${name},</p>
            <p style="color: #4a5568; font-size: 15px; line-height: 1.7; margin: 0 0 28px;">
              Thank you for scheduling a consultation. Your appointment details are below. You'll receive a calendar invite and Google Meet link shortly.
            </p>

            <div style="background: #F9F0EC; border-radius: 12px; padding: 24px; margin-bottom: 28px;">
              <h2 style="color: #355E3B; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 16px;">Appointment Details</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="color: #6B8C7A; font-size: 13px; padding: 6px 0; width: 40%;">Service</td><td style="color: #1B2A4A; font-size: 14px; font-weight: 600; padding: 6px 0;">${service}</td></tr>
                <tr><td style="color: #6B8C7A; font-size: 13px; padding: 6px 0;">Date</td><td style="color: #1B2A4A; font-size: 14px; font-weight: 600; padding: 6px 0;">${date}</td></tr>
                <tr><td style="color: #6B8C7A; font-size: 13px; padding: 6px 0;">Time</td><td style="color: #1B2A4A; font-size: 14px; font-weight: 600; padding: 6px 0;">${time}</td></tr>
                ${firm ? `<tr><td style="color: #6B8C7A; font-size: 13px; padding: 6px 0;">Firm</td><td style="color: #1B2A4A; font-size: 14px; font-weight: 600; padding: 6px 0;">${firm}</td></tr>` : ""}
                ${budget ? `<tr><td style="color: #6B8C7A; font-size: 13px; padding: 6px 0;">Budget</td><td style="color: #1B2A4A; font-size: 14px; font-weight: 600; padding: 6px 0;">${budget}</td></tr>` : ""}
              </table>
            </div>

            ${caseSummary ? `
            <div style="background: #fff; border: 1px solid #E8D5C4; border-radius: 12px; padding: 20px; margin-bottom: 28px;">
              <h2 style="color: #355E3B; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 10px;">Case Summary</h2>
              <p style="color: #4a5568; font-size: 14px; line-height: 1.7; margin: 0;">${caseSummary}</p>
            </div>` : ""}

            <p style="color: #4a5568; font-size: 14px; line-height: 1.7; margin: 0 0 8px;">
              Questions before our call? Reply to this email or reach out at <a href="mailto:broussardlegalservices@gmail.com" style="color: #355E3B;">broussardlegalservices@gmail.com</a>.
            </p>
            <p style="color: #4a5568; font-size: 14px; margin: 0;">Looking forward to speaking with you.</p>
            <p style="color: #1B2A4A; font-size: 14px; font-weight: 600; margin: 20px 0 0;">— Maggi May Broussard</p>
          </div>
          <div style="background: #F9F0EC; padding: 20px 40px; text-align: center; border-top: 1px solid #E8D5C4;">
            <p style="color: #6B8C7A; font-size: 12px; margin: 0;">Broussard Legal Services · Remote Contract Paralegal Services</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "onboarding@resend.dev",
        to: [email],
        subject: `Consultation Confirmed — ${service} on ${date}`,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Resend error: ${err}`);
    }

    const data = await res.json();

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
