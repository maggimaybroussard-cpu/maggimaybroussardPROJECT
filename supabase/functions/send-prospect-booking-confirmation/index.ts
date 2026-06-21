import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const SITE_URL = "https://broussardlegalservices.com";

const brand = {
  bg: "#FAF7F2",
  primary: "#4A3728",
  accent: "#C8965A",
  accentLight: "#F5EDE0",
  foreground: "#2C1F14",
  muted: "#7A6B5D",
  border: "#D9D0C5",
  secondary: "#EDE8E0",
  white: "#FFFFFF",
  green: "#355E3B",
  greenLight: "rgba(53,94,59,0.08)",
  greenBorder: "rgba(53,94,59,0.18)",
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

    const firstName = (name || "").split(" ")[0] || name;

    const prepItems = [
      { icon: "📋", title: "Summary of your matter", detail: "A brief written overview of your legal support needs, timeline, and any key parties involved." },
      { icon: "📄", title: "Relevant documents", detail: "Contracts, correspondence, court filings, or any paperwork related to your situation." },
      { icon: "❓", title: "Your questions", detail: "Write down your top 3–5 questions so we can cover what matters most to you." },
      { icon: "🎯", title: "Your goals", detail: "What outcome are you hoping for? Understanding your priorities helps us advise you effectively." },
      { icon: "📅", title: "Key dates & deadlines", detail: "Any upcoming court dates, filing deadlines, or contract expiration dates we should know about." },
    ];

    const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:${brand.secondary};font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:${brand.secondary};padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background-color:${brand.bg};border-radius:14px;overflow:hidden;border:1px solid ${brand.border};box-shadow:0 4px 24px rgba(74,55,40,0.10);">
        <!-- Header accent bar -->
        <tr><td style="height:4px;background:linear-gradient(to right,${brand.accent},#E8B87A,${brand.accent});"></td></tr>
        <!-- Brand header -->
        <tr>
          <td style="background-color:${brand.primary};padding:28px 36px 24px;">
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
        </tr>
        <!-- Confirmation badge -->
        <tr>
          <td style="padding:32px 36px 0;">
            <div style="display:inline-block;padding:8px 18px;background-color:rgba(53,94,59,0.1);border-radius:20px;margin-bottom:20px;">
              <span style="font-size:13px;color:${brand.green};font-family:Georgia,serif;font-weight:bold;letter-spacing:0.04em;">&#10003; Consultation Confirmed</span>
            </div>
            <h2 style="margin:0 0 8px;font-size:22px;color:${brand.foreground};font-family:Georgia,serif;font-weight:normal;">Your consultation is booked, ${firstName}.</h2>
            <p style="margin:0 0 24px;font-size:15px;color:${brand.muted};font-family:Georgia,serif;line-height:1.7;">We look forward to speaking with you. Here are your booking details and everything you need to prepare for a productive session.</p>
          </td>
        </tr>
        <!-- Booking details card -->
        <tr>
          <td style="padding:0 36px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:${brand.accentLight};border-radius:10px;border:1px solid ${brand.border};overflow:hidden;">
              <tr>
                <td style="padding:20px 24px;">
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td style="padding-bottom:14px;border-bottom:1px solid ${brand.border};">
                        <p style="margin:0 0 4px;font-size:11px;color:${brand.muted};font-family:Georgia,serif;text-transform:uppercase;letter-spacing:0.1em;">Service</p>
                        <p style="margin:0;font-size:16px;color:${brand.foreground};font-family:Georgia,serif;font-weight:bold;">${service}</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:14px 0;border-bottom:1px solid ${brand.border};">
                        <p style="margin:0 0 4px;font-size:11px;color:${brand.muted};font-family:Georgia,serif;text-transform:uppercase;letter-spacing:0.1em;">Date</p>
                        <p style="margin:0;font-size:16px;color:${brand.foreground};font-family:Georgia,serif;font-weight:bold;">${date}</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding-top:14px;${firm || budget ? "border-bottom:1px solid " + brand.border + ";" : ""}">
                        <p style="margin:0 0 4px;font-size:11px;color:${brand.muted};font-family:Georgia,serif;text-transform:uppercase;letter-spacing:0.1em;">Time</p>
                        <p style="margin:0;font-size:16px;color:${brand.foreground};font-family:Georgia,serif;font-weight:bold;">${time} CST</p>
                      </td>
                    </tr>
                    ${firm ? `<tr><td style="padding-top:14px;${budget ? "border-bottom:1px solid " + brand.border + ";" : ""}"><p style="margin:0 0 4px;font-size:11px;color:${brand.muted};font-family:Georgia,serif;text-transform:uppercase;letter-spacing:0.1em;">Firm</p><p style="margin:0;font-size:14px;color:${brand.foreground};font-family:Georgia,serif;font-weight:bold;">${firm}</p></td></tr>` : ""}
                    ${budget ? `<tr><td style="padding-top:14px;"><p style="margin:0 0 4px;font-size:11px;color:${brand.muted};font-family:Georgia,serif;text-transform:uppercase;letter-spacing:0.1em;">Budget</p><p style="margin:0;font-size:14px;color:${brand.foreground};font-family:Georgia,serif;font-weight:bold;">${budget}</p></td></tr>` : ""}
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        ${caseSummary ? `
        <!-- Case Summary -->
        <tr>
          <td style="padding:0 36px 24px;">
            <div style="background-color:${brand.bg};border:1px solid ${brand.border};border-radius:10px;padding:18px 22px;">
              <p style="margin:0 0 8px;font-size:12px;font-weight:bold;color:${brand.foreground};font-family:Georgia,serif;text-transform:uppercase;letter-spacing:0.08em;">Your Case Summary</p>
              <p style="margin:0;font-size:14px;color:${brand.muted};font-family:Georgia,serif;line-height:1.7;">${caseSummary}</p>
            </div>
          </td>
        </tr>` : ""}
        <!-- Prep instructions -->
        <tr>
          <td style="padding:0 36px 28px;">
            <div style="border-top:1px solid ${brand.border};padding-top:24px;">
              <p style="margin:0 0 6px;font-size:14px;font-weight:bold;color:${brand.foreground};font-family:Georgia,serif;text-transform:uppercase;letter-spacing:0.08em;">How to Prepare</p>
              <p style="margin:0 0 18px;font-size:13px;color:${brand.muted};font-family:Georgia,serif;line-height:1.6;">To make the most of your consultation, please have the following ready:</p>
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                ${prepItems.map((item, i) => `
                <tr>
                  <td style="padding:${i === 0 ? "0" : "12px"} 0 12px;${i < prepItems.length - 1 ? "border-bottom:1px solid " + brand.border + ";" : ""}">
                    <table cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="vertical-align:top;padding-right:12px;font-size:18px;line-height:1;">${item.icon}</td>
                        <td>
                          <p style="margin:0 0 3px;font-size:14px;color:${brand.foreground};font-family:Georgia,serif;font-weight:bold;">${item.title}</p>
                          <p style="margin:0;font-size:13px;color:${brand.muted};font-family:Georgia,serif;line-height:1.6;">${item.detail}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>`).join("")}
              </table>
            </div>
          </td>
        </tr>
        <!-- Portal CTA -->
        <tr>
          <td style="padding:0 36px 28px;">
            <div style="background-color:${brand.greenLight};border:1px solid ${brand.greenBorder};border-radius:10px;padding:18px 22px;">
              <p style="margin:0 0 6px;font-size:13px;font-weight:bold;color:${brand.green};font-family:Georgia,serif;">Access Your Client Portal</p>
              <p style="margin:0 0 12px;font-size:13px;color:${brand.muted};font-family:Georgia,serif;line-height:1.6;">Upload documents, track your matter, and communicate securely before your consultation.</p>
              <table cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="border:1px solid ${brand.greenBorder};border-radius:6px;">
                    <a href="${SITE_URL}/portal/dashboard" style="display:inline-block;padding:10px 20px;color:${brand.green};text-decoration:none;font-size:12px;font-family:Georgia,serif;letter-spacing:0.05em;font-weight:bold;">Go to Portal &rarr;</a>
                  </td>
                </tr>
              </table>
            </div>
          </td>
        </tr>
        <!-- Contact reminders -->
        <tr>
          <td style="padding:0 36px 28px;">
            <div style="background-color:${brand.accentLight};border-radius:10px;border:1px solid ${brand.border};padding:20px 24px;">
              <p style="margin:0 0 14px;font-size:13px;font-weight:bold;color:${brand.foreground};font-family:Georgia,serif;text-transform:uppercase;letter-spacing:0.08em;">Need to Reach Us?</p>
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="padding-bottom:10px;border-bottom:1px solid ${brand.border};">
                    <table cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="padding-right:10px;font-size:16px;">✉️</td>
                        <td>
                          <p style="margin:0 0 2px;font-size:12px;color:${brand.muted};font-family:Georgia,serif;text-transform:uppercase;letter-spacing:0.08em;">Email</p>
                          <a href="mailto:broussardlegalservices@gmail.com" style="font-size:14px;color:${brand.accent};font-family:Georgia,serif;text-decoration:none;font-weight:bold;">broussardlegalservices@gmail.com</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:10px;padding-bottom:10px;border-bottom:1px solid ${brand.border};">
                    <table cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="padding-right:10px;font-size:16px;">🌐</td>
                        <td>
                          <p style="margin:0 0 2px;font-size:12px;color:${brand.muted};font-family:Georgia,serif;text-transform:uppercase;letter-spacing:0.08em;">Website</p>
                          <a href="${SITE_URL}" style="font-size:14px;color:${brand.accent};font-family:Georgia,serif;text-decoration:none;font-weight:bold;">${SITE_URL.replace("https://", "")}</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:10px;">
                    <table cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="padding-right:10px;font-size:16px;">🔒</td>
                        <td>
                          <p style="margin:0 0 2px;font-size:12px;color:${brand.muted};font-family:Georgia,serif;text-transform:uppercase;letter-spacing:0.08em;">Secure Messaging</p>
                          <a href="${SITE_URL}/portal/messages" style="font-size:14px;color:${brand.accent};font-family:Georgia,serif;text-decoration:none;font-weight:bold;">Send a message via Client Portal</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <p style="margin:16px 0 0;font-size:12px;color:${brand.muted};font-family:Georgia,serif;line-height:1.6;font-style:italic;">Need to reschedule? Reply to this email at least 24 hours before your appointment and we will find a new time that works for you.</p>
            </div>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background-color:${brand.secondary};padding:20px 36px;border-top:1px solid ${brand.border};">
            <p style="margin:0;font-size:11px;color:${brand.muted};font-family:Georgia,serif;">Maggi May Broussard Legal Services &nbsp;&middot;&nbsp; Louisiana &amp; Nationwide</p>
            <p style="margin:6px 0 0;font-size:11px;color:${brand.muted};font-family:Georgia,serif;">
              <a href="${SITE_URL}" style="color:${brand.accent};text-decoration:none;">${SITE_URL.replace("https://", "")}</a>
              &nbsp;&middot;&nbsp;
              <a href="mailto:broussardlegalservices@gmail.com" style="color:${brand.accent};text-decoration:none;">broussardlegalservices@gmail.com</a>
            </p>
            <p style="margin:8px 0 0;font-size:10px;color:${brand.muted};font-family:Georgia,serif;opacity:0.7;">This email was sent to confirm your consultation booking. Attorney-client privilege applies from first contact.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "onboarding@resend.dev",
        to: [email],
        subject: `Consultation Confirmed — ${service} on ${date} at ${time} CST`,
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
