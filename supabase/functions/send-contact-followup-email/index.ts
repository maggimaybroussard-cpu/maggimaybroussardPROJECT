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
  green: "#355E3B",
  greenLight: "#EAF2EB",
};

// ─── Shared Layout Helpers ────────────────────────────────────────────────────

function emailWrapper(content: string, preheader = ""): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Maggi May Broussard Legal Services</title>
  ${preheader ? `<!--[if !mso]><!--><div style="display:none;font-size:1px;color:#fefefe;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</div><!--<![endif]-->` : ""}
</head>
<body style="margin:0;padding:0;background-color:#EDE8E0;font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#EDE8E0;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background-color:${brand.bg};border-radius:14px;overflow:hidden;border:1px solid ${brand.border};box-shadow:0 4px 24px rgba(74,55,40,0.10);">
        <tr><td style="height:4px;background:linear-gradient(to right,${brand.accent},#E8B87A,${brand.accent});"></td></tr>
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
        <tr>
          <td style="padding:36px 36px 32px;">
            ${content}
          </td>
        </tr>
        <tr>
          <td style="background-color:${brand.secondary};padding:20px 36px;border-top:1px solid ${brand.border};">
            <p style="margin:0 0 4px;font-size:12px;color:${brand.primary};font-weight:bold;font-family:Georgia,serif;letter-spacing:0.04em;">Maggi May Broussard Legal Services</p>
            <p style="margin:0;font-size:11px;color:${brand.muted};line-height:1.7;font-family:Georgia,serif;">
              You received this because you contacted us at maggimay.com.
              &nbsp;·&nbsp;
              <a href="${SITE_URL}" style="color:${brand.accent};text-decoration:none;">Visit our site</a>
              &nbsp;·&nbsp;
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

function badge(label: string, color = brand.accent): string {
  return `<span style="display:inline-block;background-color:${color};color:${brand.white};font-size:10px;font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;padding:4px 14px;border-radius:20px;margin-bottom:22px;font-family:Georgia,serif;">${label}</span>`;
}

function sectionTitle(text: string): string {
  return `<h2 style="margin:0 0 20px;font-size:21px;color:${brand.foreground};font-family:Georgia,'Times New Roman',serif;font-weight:normal;letter-spacing:-0.01em;border-bottom:1px solid ${brand.border};padding-bottom:14px;">${text}</h2>`;
}

function bodyText(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;color:${brand.foreground};line-height:1.8;font-family:Georgia,serif;">${text}</p>`;
}

function ctaButton(href: string, label: string, color = brand.accent): string {
  return `<table cellpadding="0" cellspacing="0" role="presentation" style="margin:24px 0;">
    <tr>
      <td style="background-color:${color};border-radius:7px;box-shadow:0 2px 8px rgba(200,150,90,0.30);">
        <a href="${href}" style="display:inline-block;padding:14px 36px;color:${brand.white};text-decoration:none;font-size:14px;font-family:Georgia,serif;letter-spacing:0.05em;font-weight:bold;">${label} &rarr;</a>
      </td>
    </tr>
  </table>`;
}

function signature(closing = "Warm regards"): string {
  return `<table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:28px;border-top:1px solid ${brand.border};padding-top:20px;width:100%;">
    <tr>
      <td>
        <p style="margin:0 0 4px;font-size:15px;color:${brand.foreground};font-family:Georgia,serif;">${closing},</p>
        <p style="margin:0 0 2px;font-size:16px;color:${brand.primary};font-weight:bold;font-family:Georgia,serif;">Maggi May Broussard</p>
        <p style="margin:0 0 6px;font-size:12px;color:${brand.muted};font-family:Georgia,serif;letter-spacing:0.04em;">Broussard Legal Services</p>
        <a href="mailto:broussardlegalservices@gmail.com" style="color:${brand.accent};font-size:13px;text-decoration:none;font-family:Georgia,serif;">broussardlegalservices@gmail.com</a>
        &nbsp;<span style="color:${brand.border};">|</span>&nbsp;
        <a href="${SITE_URL}" style="color:${brand.accent};font-size:13px;text-decoration:none;font-family:Georgia,serif;">maggimay.com</a>
      </td>
    </tr>
  </table>`;
}

// ─── Step 1: Day 0 — Confirmation + Next Steps ────────────────────────────────

function step1Email(name: string, service: string, source: string): { subject: string; html: string } {
  const firstName = name.split(" ")[0];
  const isBooking = source === "booking";

  const content = `
    ${badge("&#10003; " + (isBooking ? "Booking Confirmed" : "Inquiry Received"))}
    ${sectionTitle(`Welcome, ${firstName} — here's what happens next`)}
    ${bodyText(`Thank you for reaching out about <strong>${service}</strong>. ${isBooking ? "Your consultation is confirmed and I'm looking forward to speaking with you." : "I've received your inquiry and will personally follow up within one business day."}`)}
    ${bodyText(`To make the most of our time together, here's a quick overview of the next steps:`)}

    <div style="background-color:${brand.accentLight};border-left:3px solid ${brand.accent};padding:20px 24px;border-radius:0 8px 8px 0;margin:0 0 24px;">
      <p style="margin:0 0 12px;font-size:12px;color:${brand.accent};font-weight:bold;text-transform:uppercase;letter-spacing:0.1em;font-family:Georgia,serif;">Your Next Steps</p>
      <p style="margin:0 0 10px;font-size:14px;color:${brand.foreground};line-height:1.7;font-family:Georgia,serif;">&#8594;&nbsp; <strong>Step 1:</strong> ${isBooking ? "Prepare for your consultation — gather any relevant documents, contracts, or correspondence" : "Watch for my personal reply within 1 business day"}</p>
      <p style="margin:0 0 10px;font-size:14px;color:${brand.foreground};line-height:1.7;font-family:Georgia,serif;">&#8594;&nbsp; <strong>Step 2:</strong> ${isBooking ? "Join the meeting link sent in your booking confirmation" : "We'll schedule a free consultation to discuss your needs in detail"}</p>
      <p style="margin:0 0 10px;font-size:14px;color:${brand.foreground};line-height:1.7;font-family:Georgia,serif;">&#8594;&nbsp; <strong>Step 3:</strong> I'll propose a tailored engagement plan that fits your workflow and budget</p>
      <p style="margin:0;font-size:14px;color:${brand.foreground};line-height:1.7;font-family:Georgia,serif;">&#8594;&nbsp; <strong>Step 4:</strong> We begin work — with clear milestones, secure document sharing, and direct communication</p>
    </div>

    <div style="background-color:${brand.bgCard};border:1px solid ${brand.border};border-radius:10px;overflow:hidden;margin:0 0 24px;">
      <div style="background-color:${brand.primary};padding:10px 22px;">
        <p style="margin:0;font-size:11px;color:${brand.accent};font-weight:bold;text-transform:uppercase;letter-spacing:0.12em;font-family:Georgia,serif;">&#128203; Services I Provide</p>
      </div>
      <div style="padding:20px 22px;">
        <table style="width:100%;border-collapse:collapse;font-family:Georgia,serif;">
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid rgba(217,208,197,0.5);font-size:14px;color:${brand.foreground};">&#9679;&nbsp; Legal Research &amp; Drafting</td>
            <td style="padding:8px 0;border-bottom:1px solid rgba(217,208,197,0.5);font-size:14px;color:${brand.foreground};">&#9679;&nbsp; Contract Review &amp; Analysis</td>
          </tr>
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid rgba(217,208,197,0.5);font-size:14px;color:${brand.foreground};">&#9679;&nbsp; Document Preparation</td>
            <td style="padding:8px 0;border-bottom:1px solid rgba(217,208,197,0.5);font-size:14px;color:${brand.foreground};">&#9679;&nbsp; Case Management Support</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-size:14px;color:${brand.foreground};">&#9679;&nbsp; Litigation Support</td>
            <td style="padding:8px 0;font-size:14px;color:${brand.foreground};">&#9679;&nbsp; Retainer-Based Partnerships</td>
          </tr>
        </table>
      </div>
    </div>

    ${!isBooking ? ctaButton(`${SITE_URL}/availability`, "Book a Free Consultation") : ctaButton(`${SITE_URL}/portal/dashboard`, "Access Your Client Portal")}

    ${bodyText(`In the meantime, feel free to explore my <a href="${SITE_URL}/services" style="color:${brand.accent};text-decoration:underline;">services page</a> or <a href="${SITE_URL}/case-studies" style="color:${brand.accent};text-decoration:underline;">case studies</a> to see how I've helped attorneys and firms like yours.`)}

    ${signature()}
  `;

  return {
    subject: isBooking
      ? `Your Consultation is Confirmed — Next Steps Inside`
      : `Your Inquiry is Received — Here's What Happens Next`,
    html: emailWrapper(content, `Thank you for reaching out about ${service}. Here's what to expect next.`),
  };
}

// ─── Step 2: Day 2 — Case Study / Service Deep-Dive ──────────────────────────

function step2Email(name: string, service: string): { subject: string; html: string } {
  const firstName = name.split(" ")[0];

  const content = `
    ${badge("&#128214; Case Study &amp; Service Deep-Dive")}
    ${sectionTitle(`See how I've helped firms like yours, ${firstName}`)}
    ${bodyText(`Two days ago you reached out about <strong>${service}</strong>. I wanted to share a real-world example of how my paralegal services have delivered measurable results for attorneys and law firms.`)}

    <!-- Case Study Card -->
    <div style="background-color:${brand.bgCard};border:1px solid ${brand.border};border-radius:10px;overflow:hidden;margin:0 0 24px;">
      <div style="background-color:${brand.primary};padding:12px 22px;">
        <p style="margin:0;font-size:11px;color:${brand.accent};font-weight:bold;text-transform:uppercase;letter-spacing:0.12em;font-family:Georgia,serif;">&#128203; Featured Case Study</p>
      </div>
      <div style="padding:24px 22px;">
        <p style="margin:0 0 6px;font-size:18px;color:${brand.foreground};font-weight:bold;font-family:Georgia,serif;">Litigation Support for a Solo Practitioner</p>
        <p style="margin:0 0 16px;font-size:12px;color:${brand.muted};font-family:Georgia,serif;text-transform:uppercase;letter-spacing:0.08em;">Civil Litigation · Document Drafting · Case Management</p>
        <p style="margin:0 0 16px;font-size:14px;color:${brand.foreground};line-height:1.8;font-family:Georgia,serif;">
          A solo practitioner handling a complex civil matter needed comprehensive litigation support — from drafting motions and discovery requests to organizing a 500-page document production. With tight court deadlines and limited staff, they needed a reliable paralegal partner fast.
        </p>
        <div style="background-color:${brand.accentLight};border-radius:8px;padding:16px 20px;margin:0 0 16px;">
          <p style="margin:0 0 10px;font-size:12px;color:${brand.accent};font-weight:bold;text-transform:uppercase;letter-spacing:0.1em;font-family:Georgia,serif;">Results Delivered</p>
          <p style="margin:0 0 8px;font-size:14px;color:${brand.foreground};line-height:1.7;font-family:Georgia,serif;">&#10003;&nbsp; All court filings submitted on time — zero missed deadlines</p>
          <p style="margin:0 0 8px;font-size:14px;color:${brand.foreground};line-height:1.7;font-family:Georgia,serif;">&#10003;&nbsp; 40+ hours of attorney time saved on document review and drafting</p>
          <p style="margin:0 0 8px;font-size:14px;color:${brand.foreground};line-height:1.7;font-family:Georgia,serif;">&#10003;&nbsp; Organized and indexed full discovery production in under 72 hours</p>
          <p style="margin:0;font-size:14px;color:${brand.foreground};line-height:1.7;font-family:Georgia,serif;">&#10003;&nbsp; Attorney retained me on a monthly retainer after the matter closed</p>
        </div>
        <p style="margin:0;font-size:13px;color:${brand.muted};font-style:italic;font-family:Georgia,serif;">"Maggi handled everything with precision and professionalism. I couldn't have met those deadlines without her support." — Louisiana Solo Practitioner</p>
      </div>
    </div>

    <!-- Service Deep-Dive -->
    <div style="background-color:${brand.bgCard};border:1px solid ${brand.border};border-radius:10px;overflow:hidden;margin:0 0 24px;">
      <div style="background-color:${brand.primary};padding:12px 22px;">
        <p style="margin:0;font-size:11px;color:${brand.accent};font-weight:bold;text-transform:uppercase;letter-spacing:0.12em;font-family:Georgia,serif;">&#128269; What's Included in ${service}</p>
      </div>
      <div style="padding:20px 22px;">
        <table style="width:100%;border-collapse:collapse;font-family:Georgia,serif;">
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid rgba(217,208,197,0.5);vertical-align:top;">
              <p style="margin:0 0 3px;font-size:14px;color:${brand.foreground};font-weight:bold;">&#128196; Document Drafting &amp; Review</p>
              <p style="margin:0;font-size:12px;color:${brand.muted};line-height:1.6;">Motions, briefs, contracts, demand letters, and correspondence — drafted to your specifications and reviewed for accuracy.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid rgba(217,208,197,0.5);vertical-align:top;">
              <p style="margin:0 0 3px;font-size:14px;color:${brand.foreground};font-weight:bold;">&#128269; Legal Research</p>
              <p style="margin:0;font-size:12px;color:${brand.muted};line-height:1.6;">Thorough case law research, statutory analysis, and regulatory review delivered in clear, actionable memos.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid rgba(217,208,197,0.5);vertical-align:top;">
              <p style="margin:0 0 3px;font-size:14px;color:${brand.foreground};font-weight:bold;">&#128203; Case &amp; Deadline Management</p>
              <p style="margin:0;font-size:12px;color:${brand.muted};line-height:1.6;">Organized case files, court deadline tracking, and proactive status updates so nothing falls through the cracks.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0;vertical-align:top;">
              <p style="margin:0 0 3px;font-size:14px;color:${brand.foreground};font-weight:bold;">&#128274; Secure Client Portal Access</p>
              <p style="margin:0;font-size:12px;color:${brand.muted};line-height:1.6;">All documents, communications, and case updates in one secure, organized portal — accessible 24/7.</p>
            </td>
          </tr>
        </table>
      </div>
    </div>

    ${ctaButton(`${SITE_URL}/services`, "Explore All Services")}

    ${bodyText(`Ready to discuss how I can support your practice? Book a free 30-minute consultation and let's map out a plan tailored to your needs.`)}

    ${ctaButton(`${SITE_URL}/availability`, "Schedule a Free Consultation")}

    ${signature()}
  `;

  return {
    subject: `How I Helped a Firm Like Yours — Case Study Inside`,
    html: emailWrapper(content, `See real results from my paralegal services — and how I can help your practice.`),
  };
}

// ─── Step 3: Day 7 — Limited-Time Consultation Offer ─────────────────────────

function step3Email(name: string, service: string): { subject: string; html: string } {
  const firstName = name.split(" ")[0];

  // Offer expires in 7 days from now
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 7);
  const expiryStr = expiryDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const content = `
    ${badge("&#9201; Limited-Time Offer", "#B85C38")}
    ${sectionTitle(`A special offer for you, ${firstName} — expires ${expiryStr}`)}
    ${bodyText(`It's been a week since you reached out about <strong>${service}</strong>. I don't want you to miss the opportunity to get the legal support your practice deserves.`)}
    ${bodyText(`For a limited time, I'm offering a <strong>complimentary 45-minute strategy consultation</strong> (normally 30 minutes) — exclusively for contacts who haven't yet booked a call.`)}

    <!-- Offer Card -->
    <div style="background-color:#FFF8F5;border:2px solid #C8965A;border-radius:12px;overflow:hidden;margin:0 0 24px;">
      <div style="background:linear-gradient(135deg,#4A3728,#6B4E3D);padding:16px 24px;">
        <p style="margin:0;font-size:14px;color:#C8965A;font-weight:bold;text-transform:uppercase;letter-spacing:0.12em;font-family:Georgia,serif;">&#127381; Exclusive Offer</p>
        <p style="margin:4px 0 0;font-size:22px;color:#FFFFFF;font-family:Georgia,serif;font-weight:normal;">Free 45-Minute Strategy Session</p>
      </div>
      <div style="padding:24px;">
        <table style="width:100%;border-collapse:collapse;font-family:Georgia,serif;">
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid rgba(217,208,197,0.5);vertical-align:top;">
              <p style="margin:0;font-size:14px;color:${brand.foreground};line-height:1.7;">&#10003;&nbsp; <strong>45 minutes</strong> of dedicated one-on-one time (vs. standard 30 min)</p>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid rgba(217,208,197,0.5);vertical-align:top;">
              <p style="margin:0;font-size:14px;color:${brand.foreground};line-height:1.7;">&#10003;&nbsp; <strong>Custom workflow audit</strong> — I'll identify exactly where paralegal support can save you time</p>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid rgba(217,208,197,0.5);vertical-align:top;">
              <p style="margin:0;font-size:14px;color:${brand.foreground};line-height:1.7;">&#10003;&nbsp; <strong>Tailored engagement proposal</strong> delivered within 24 hours of our call</p>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0;vertical-align:top;">
              <p style="margin:0;font-size:14px;color:${brand.foreground};line-height:1.7;">&#10003;&nbsp; <strong>No obligation</strong> — if we're not the right fit, I'll point you in the right direction</p>
            </td>
          </tr>
        </table>
        <div style="background-color:#FFF0E8;border:1px dashed #C8965A;border-radius:8px;padding:14px 18px;margin:16px 0 0;">
          <p style="margin:0;font-size:13px;color:#B85C38;font-weight:bold;font-family:Georgia,serif;text-align:center;">
            &#9201;&nbsp; This offer expires on <strong>${expiryStr}</strong>. Only a limited number of slots available.
          </p>
        </div>
      </div>
    </div>

    ${ctaButton(`${SITE_URL}/availability`, "Claim Your Free 45-Min Session", "#B85C38")}

    <!-- Testimonial -->
    <div style="background-color:${brand.bgCard};border:1px solid ${brand.border};border-radius:10px;padding:20px 24px;margin:0 0 24px;">
      <p style="margin:0 0 12px;font-size:14px;color:${brand.foreground};line-height:1.8;font-style:italic;font-family:Georgia,serif;">
        "Working with Maggi transformed how our firm handles document-heavy cases. She's responsive, thorough, and genuinely invested in our success. The retainer arrangement has been one of the best investments we've made."
      </p>
      <p style="margin:0;font-size:13px;color:${brand.muted};font-family:Georgia,serif;font-weight:bold;">— Attorney, Louisiana Family Law Practice</p>
    </div>

    ${bodyText(`If now isn't the right time, no worries at all — I'll be here when you're ready. You can always reach me directly at <a href="mailto:broussardlegalservices@gmail.com" style="color:${brand.accent};text-decoration:underline;">broussardlegalservices@gmail.com</a> or call <a href="tel:+15044582831" style="color:${brand.accent};text-decoration:underline;">1-504-458-2831</a>.`)}

    ${signature("Looking forward to connecting")}
  `;

  return {
    subject: `⏰ Your Free 45-Min Strategy Session Expires ${expiryStr}`,
    html: emailWrapper(content, `A limited-time offer just for you — claim your free 45-minute strategy session before it expires.`),
  };
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

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
    const {
      sequenceId,
      inquiryId,
      stepNumber,
      recipientEmail,
      recipientName,
      service,
      source,
    } = await req.json();

    if (!sequenceId || !recipientEmail || !recipientName || !stepNumber) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = (globalThis as any)?.Deno?.env?.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = (globalThis as any)?.Deno?.env?.get("SUPABASE_SERVICE_ROLE_KEY");
    const RESEND_API_KEY = (globalThis as any)?.Deno?.env?.get("RESEND_API_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Build the correct email for this step
    let emailPayload: { subject: string; html: string };
    const serviceName = service || "Legal Services";
    const emailSource = source || "contact_form";

    if (stepNumber === 1) {
      emailPayload = step1Email(recipientName, serviceName, emailSource);
    } else if (stepNumber === 2) {
      emailPayload = step2Email(recipientName, serviceName);
    } else if (stepNumber === 3) {
      emailPayload = step3Email(recipientName, serviceName);
    } else {
      return new Response(JSON.stringify({ error: `Unknown step number: ${stepNumber}` }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Send via Resend
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "onboarding@resend.dev",
        to: [recipientEmail],
        subject: emailPayload.subject,
        html: emailPayload.html,
      }),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.json().catch(() => ({}));
      throw new Error((errBody as any)?.message || `Resend error ${resendRes.status}`);
    }

    const resendData = await resendRes.json();

    // Mark sequence step as sent
    await supabase
      .from("email_sequences")
      .update({ send_status: "sent", sent_at: new Date().toISOString() })
      .eq("id", sequenceId);

    return new Response(
      JSON.stringify({
        success: true,
        step: stepNumber,
        subject: emailPayload.subject,
        resendId: resendData?.id,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
