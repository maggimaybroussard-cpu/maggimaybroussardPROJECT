import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_URL = "https://broussardlegalservices.com";

const brand = {
  bg: "#FAF7F2",
  bgCard: "#FFFFFF",
  primary: "#4A3728",
  accent: "#C8965A",
  accentLight: "#F5EDE0",
  foreground: "#2C1F14",
  muted: "#7A6B5D",
  border: "#D9D0C5",
  secondary: "#EDE8E0",
  white: "#FFFFFF",
  red: "#B91C1C",
  redLight: "#FEF2F2",
  purple: "#6D28D9",
  purpleLight: "#EDE9FE",
  blue: "#1D4ED8",
  blueLight: "#EFF6FF",
  amber: "#B45309",
  amberLight: "#FFFBEB",
  green: "#355E3B",
  greenLight: "#EAF2EB",
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  deadline: "Case Deadline",
  court_date: "Court Date",
  meeting: "Meeting",
  milestone: "Case Milestone",
};

const EVENT_TYPE_COLORS: Record<string, { badge: string; badgeText: string; accent: string; accentLight: string }> = {
  deadline:   { badge: brand.red,    badgeText: brand.white, accent: brand.red,    accentLight: brand.redLight    },
  court_date: { badge: brand.purple, badgeText: brand.white, accent: brand.purple, accentLight: brand.purpleLight },
  meeting:    { badge: brand.blue,   badgeText: brand.white, accent: brand.blue,   accentLight: brand.blueLight   },
  milestone:  { badge: brand.amber,  badgeText: brand.white, accent: brand.amber,  accentLight: brand.amberLight  },
};

function buildEmailHtml(opts: {
  paralegalName: string;
  eventType: string;
  eventTitle: string;
  caseName: string | null;
  eventDate: string;
  eventTime: string;
  location: string | null;
  description: string | null;
  notes: string | null;
  daysBefore: number;
}): { subject: string; html: string } {
  const typeLabel = EVENT_TYPE_LABELS[opts.eventType] ?? "Scheduled Event";
  const colors = EVENT_TYPE_COLORS[opts.eventType] ?? EVENT_TYPE_COLORS.deadline;
  const firstName = opts.paralegalName.split(" ")[0] || opts.paralegalName;

  const urgencyText =
    opts.daysBefore === 1
      ? "⚠️ Tomorrow"
      : opts.daysBefore <= 3
      ? `⏰ In ${opts.daysBefore} Days`
      : `📅 In ${opts.daysBefore} Days`;

  const subject =
    opts.daysBefore === 1
      ? `[TOMORROW] ${typeLabel}: ${opts.eventTitle}`
      : `[Reminder] ${typeLabel} in ${opts.daysBefore} days — ${opts.eventTitle}`;

  const preheader = `${typeLabel} reminder: "${opts.eventTitle}" is scheduled for ${opts.eventDate}. Please review and prepare.`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <div style="display:none;font-size:1px;color:#fefefe;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</div>
</head>
<body style="margin:0;padding:0;background-color:#EDE8E0;font-family:Georgia,'Times New Roman',serif;-webkit-text-size-adjust:100%;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#EDE8E0;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background-color:${brand.bg};border-radius:14px;overflow:hidden;border:1px solid ${brand.border};box-shadow:0 4px 24px rgba(74,55,40,0.10);">

        <!-- HEADER -->
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
              </tr>
            </table>
            <div style="height:1px;background:linear-gradient(to right,${brand.accent},rgba(200,150,90,0.2),transparent);margin:0 36px;"></div>
            <div style="height:20px;"></div>
          </td>
        </tr>

        <!-- BODY -->
        <tr>
          <td style="padding:32px 36px 36px;">
            <span style="display:inline-block;background-color:${colors.badge};color:${colors.badgeText};font-size:10px;font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;padding:4px 14px;border-radius:20px;margin-bottom:8px;font-family:Georgia,serif;">${typeLabel}</span>
            <span style="display:inline-block;background-color:${colors.accentLight};color:${colors.accent};font-size:10px;font-weight:bold;letter-spacing:0.10em;text-transform:uppercase;padding:4px 14px;border-radius:20px;margin-bottom:22px;margin-left:8px;font-family:Georgia,serif;">${urgencyText}</span>

            <h2 style="margin:0 0 20px;font-size:21px;color:${brand.foreground};font-family:Georgia,'Times New Roman',serif;font-weight:normal;letter-spacing:-0.01em;border-bottom:1px solid ${brand.border};padding-bottom:14px;">
              Upcoming ${typeLabel} Reminder
            </h2>

            <p style="margin:0 0 16px;font-size:15px;color:${brand.foreground};line-height:1.8;font-family:Georgia,serif;">
              Hi ${firstName},
            </p>
            <p style="margin:0 0 20px;font-size:15px;color:${brand.foreground};line-height:1.8;font-family:Georgia,serif;">
              This is an automated reminder that the following ${typeLabel.toLowerCase()} is coming up
              ${opts.daysBefore === 1 ? "<strong>tomorrow</strong>" : `in <strong>${opts.daysBefore} days</strong>`}.
              Please review the details below and ensure all necessary preparations are in order.
            </p>

            <!-- Event Details Card -->
            <div style="background-color:${brand.bgCard};border:1px solid ${brand.border};border-radius:10px;overflow:hidden;margin:0 0 24px;">
              <div style="background-color:${brand.primary};padding:12px 22px;">
                <p style="margin:0;font-size:11px;color:${brand.accent};font-weight:bold;text-transform:uppercase;letter-spacing:0.12em;font-family:Georgia,serif;">&#128197;&nbsp; Event Details</p>
              </div>
              <div style="padding:20px 22px;">
                <table style="width:100%;border-collapse:collapse;font-family:Georgia,serif;">
                  <tr>
                    <td style="padding:8px 0;color:${brand.muted};font-size:13px;width:38%;border-bottom:1px solid rgba(217,208,197,0.5);">Event</td>
                    <td style="padding:8px 0;color:${brand.foreground};font-size:14px;font-weight:bold;border-bottom:1px solid rgba(217,208,197,0.5);">${opts.eventTitle}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;color:${brand.muted};font-size:13px;border-bottom:1px solid rgba(217,208,197,0.5);">Type</td>
                    <td style="padding:8px 0;color:${brand.foreground};font-size:14px;border-bottom:1px solid rgba(217,208,197,0.5);">${typeLabel}</td>
                  </tr>
                  ${opts.caseName ? `
                  <tr>
                    <td style="padding:8px 0;color:${brand.muted};font-size:13px;border-bottom:1px solid rgba(217,208,197,0.5);">Case</td>
                    <td style="padding:8px 0;color:${brand.foreground};font-size:14px;border-bottom:1px solid rgba(217,208,197,0.5);">${opts.caseName}</td>
                  </tr>` : ""}
                  <tr>
                    <td style="padding:8px 0;color:${brand.muted};font-size:13px;border-bottom:1px solid rgba(217,208,197,0.5);">Date</td>
                    <td style="padding:8px 0;color:${brand.foreground};font-size:14px;font-weight:bold;border-bottom:1px solid rgba(217,208,197,0.5);">${opts.eventDate}</td>
                  </tr>
                  ${opts.eventTime ? `
                  <tr>
                    <td style="padding:8px 0;color:${brand.muted};font-size:13px;border-bottom:1px solid rgba(217,208,197,0.5);">Time</td>
                    <td style="padding:8px 0;color:${brand.foreground};font-size:14px;border-bottom:1px solid rgba(217,208,197,0.5);">${opts.eventTime}</td>
                  </tr>` : ""}
                  ${opts.location ? `
                  <tr>
                    <td style="padding:8px 0;color:${brand.muted};font-size:13px;">Location</td>
                    <td style="padding:8px 0;color:${brand.foreground};font-size:14px;">${opts.location}</td>
                  </tr>` : ""}
                </table>
              </div>
            </div>

            ${opts.description ? `
            <div style="background-color:${colors.accentLight};border-left:3px solid ${colors.accent};padding:16px 20px;border-radius:0 8px 8px 0;margin:0 0 20px;">
              <p style="margin:0 0 6px;font-size:11px;color:${colors.accent};font-weight:bold;text-transform:uppercase;letter-spacing:0.10em;font-family:Georgia,serif;">Description</p>
              <p style="margin:0;font-size:14px;color:${brand.foreground};line-height:1.7;font-family:Georgia,serif;">${opts.description}</p>
            </div>` : ""}

            ${opts.notes ? `
            <div style="background-color:${brand.secondary};border-left:3px solid ${brand.border};padding:16px 20px;border-radius:0 8px 8px 0;margin:0 0 20px;">
              <p style="margin:0 0 6px;font-size:11px;color:${brand.muted};font-weight:bold;text-transform:uppercase;letter-spacing:0.10em;font-family:Georgia,serif;">Internal Notes</p>
              <p style="margin:0;font-size:14px;color:${brand.foreground};line-height:1.7;font-family:Georgia,serif;">${opts.notes}</p>
            </div>` : ""}

            <p style="margin:0 0 20px;font-size:14px;color:${brand.muted};line-height:1.8;font-family:Georgia,serif;">
              Please log in to the admin portal to view full case details and update the event status once completed.
            </p>

            <!-- Signature -->
            <table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:28px;border-top:1px solid ${brand.border};padding-top:20px;width:100%;">
              <tr>
                <td>
                  <p style="margin:0 0 4px;font-size:15px;color:${brand.foreground};font-family:Georgia,serif;">Best regards,</p>
                  <p style="margin:0 0 2px;font-size:16px;color:${brand.primary};font-weight:bold;font-family:Georgia,serif;">Maggi May Broussard</p>
                  <p style="margin:0 0 6px;font-size:12px;color:${brand.muted};font-family:Georgia,serif;letter-spacing:0.04em;">Broussard Legal Services</p>
                  <a href="mailto:maggimaybroussard@gmail.com" style="color:${brand.accent};font-size:13px;text-decoration:none;font-family:Georgia,serif;">maggimaybroussard@gmail.com</a>
                  &nbsp;<span style="color:${brand.border};">|</span>&nbsp;
                  <a href="${SITE_URL}" style="color:${brand.accent};font-size:13px;text-decoration:none;font-family:Georgia,serif;">${SITE_URL.replace("https://", "")}</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="background-color:${brand.secondary};padding:20px 36px;border-top:1px solid ${brand.border};">
            <p style="margin:0 0 6px;font-size:12px;color:${brand.primary};font-weight:bold;font-family:Georgia,serif;letter-spacing:0.04em;">Maggi May Broussard Legal Services</p>
            <p style="margin:0;font-size:11px;color:${brand.muted};line-height:1.7;">
              This is an automated reminder sent to assigned paralegals. You are receiving this because you are assigned to this case event.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

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
    const body = await req.json();
    const {
      eventId,
      paralegalEmail,
      paralegalName,
      eventType,
      eventTitle,
      caseName,
      eventDate,
      location,
      description,
      notes,
      daysBefore,
    } = body;

    const RESEND_API_KEY = (globalThis as any)?.Deno?.env?.get("RESEND_API_KEY");
    const SUPABASE_URL = (globalThis as any)?.Deno?.env?.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = (globalThis as any)?.Deno?.env?.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase credentials not configured");
    if (!paralegalEmail) throw new Error("paralegalEmail is required");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const eventDateObj = new Date(eventDate);
    const formattedDate = eventDateObj.toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
      timeZone: "America/Chicago",
    });
    const formattedTime = eventDateObj.toLocaleTimeString("en-US", {
      hour: "numeric", minute: "2-digit", timeZoneName: "short",
      timeZone: "America/Chicago",
    });

    const { subject, html } = buildEmailHtml({
      paralegalName: paralegalName || paralegalEmail,
      eventType: eventType || "deadline",
      eventTitle: eventTitle || "Scheduled Event",
      caseName: caseName || null,
      eventDate: formattedDate,
      eventTime: formattedTime,
      location: location || null,
      description: description || null,
      notes: notes || null,
      daysBefore: daysBefore || 3,
    });

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Maggi May Broussard <maggimay@broussardlegalservices.com>",
        to: [paralegalEmail],
        subject,
        html,
      }),
    });

    let resendData: any = {};
    let sendStatus = "sent";
    let errorMessage: string | null = null;

    if (!resendRes.ok) {
      const errBody = await resendRes.json();
      sendStatus = "failed";
      errorMessage = errBody.message || "Resend API error";
    } else {
      resendData = await resendRes.json();
    }

    // Log the reminder
    await supabase.from("schedule_reminder_logs").insert({
      event_id: eventId,
      paralegal_email: paralegalEmail,
      paralegal_name: paralegalName || null,
      event_type: eventType || "deadline",
      event_title: eventTitle || "Scheduled Event",
      event_date: eventDate,
      days_before: daysBefore || 3,
      resend_email_id: resendData?.id || null,
      status: sendStatus,
      error_message: errorMessage,
    });

    // Mark reminder_sent_at on the event
    if (sendStatus === "sent" && eventId) {
      await supabase
        .from("case_schedule_events")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", eventId);
    }

    if (sendStatus === "failed") {
      throw new Error(errorMessage || "Failed to send email");
    }

    return new Response(
      JSON.stringify({ success: true, emailId: resendData?.id }),
      { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  }
});
