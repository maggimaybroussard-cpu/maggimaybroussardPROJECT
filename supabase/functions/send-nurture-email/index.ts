import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_URL = "https://broussardlegalservices.com";

// ─── Shared Brand Styles ──────────────────────────────────────────────────────
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
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="x-apple-disable-message-reformatting">
      <title>Maggi May Broussard Legal Services</title>
      ${preheader ? `<!--[if !mso]><!--><div style="display:none;font-size:1px;color:#fefefe;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</div><!--<![endif]-->` : ""}
    </head>
    <body style="margin:0; padding:0; background-color:#EDE8E0; font-family: Georgia, 'Times New Roman', serif; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#EDE8E0; padding: 40px 16px;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px; width:100%; background-color:${brand.bg}; border-radius:14px; overflow:hidden; border: 1px solid ${brand.border}; box-shadow: 0 4px 24px rgba(74,55,40,0.10);">

            <!-- ══ BRANDED HEADER ══ -->
            <tr>
              <td style="background-color:${brand.primary}; padding: 0;">
                <!-- Top accent stripe -->
                <div style="height:4px; background: linear-gradient(to right, ${brand.accent}, #E8B87A, ${brand.accent});"></div>
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="padding: 28px 36px 24px;">
                  <tr>
                    <td>
                      <!-- Wordmark -->
                      <table cellpadding="0" cellspacing="0" role="presentation">
                        <tr>
                          <td style="border-right: 2px solid ${brand.accent}; padding-right: 14px; vertical-align: middle;">
                            <p style="margin:0; font-size:10px; color:${brand.accent}; letter-spacing:0.18em; text-transform:uppercase; font-family: Georgia, serif; line-height:1.4;">Paralegal</p>
                            <p style="margin:0; font-size:10px; color:${brand.accent}; letter-spacing:0.18em; text-transform:uppercase; font-family: Georgia, serif; line-height:1.4;">Services</p>
                          </td>
                          <td style="padding-left: 14px; vertical-align: middle;">
                            <h1 style="margin:0; font-size:24px; color:${brand.white}; font-family: Georgia, 'Times New Roman', serif; font-weight:normal; letter-spacing:0.01em; line-height:1.2;">Maggi May Broussard</h1>
                            <p style="margin:4px 0 0; font-size:12px; color:rgba(255,255,255,0.65); font-family: Georgia, serif; letter-spacing:0.06em;">Louisiana &amp; Nationwide</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
                <!-- Bottom accent rule -->
                <div style="height:1px; background: linear-gradient(to right, ${brand.accent}, rgba(200,150,90,0.2), transparent); margin: 0 36px;"></div>
                <div style="height:20px;"></div>
              </td>
            </tr>

            <!-- ══ BODY ══ -->
            <tr>
              <td style="padding: 36px 36px 32px;">
                ${content}
              </td>
            </tr>

            <!-- ══ FOOTER ══ -->
            <tr>
              <td style="background-color:${brand.secondary}; padding: 20px 36px; border-top: 1px solid ${brand.border};">
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                  <tr>
                    <td>
                      <p style="margin:0 0 6px; font-size:12px; color:${brand.primary}; font-weight:bold; font-family: Georgia, serif; letter-spacing:0.04em;">Maggi May Broussard Legal Services</p>
                      <p style="margin:0; font-size:11px; color:${brand.muted}; line-height:1.7;">
                        You received this because you submitted an inquiry at maggimay.com.
                        <a href="${SITE_URL}" style="color:${brand.accent}; text-decoration:none;">Visit our site</a>
                        &nbsp;·&nbsp;
                        <a href="mailto:maggimaybroussard@gmail.com?subject=Unsubscribe" style="color:${brand.muted}; text-decoration:none;">Unsubscribe</a>
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;
}

function badge(label: string, color = brand.accent): string {
  return `<span style="display:inline-block; background-color:${color}; color:${brand.white}; font-size:10px; font-weight:bold; letter-spacing:0.12em; text-transform:uppercase; padding:4px 14px; border-radius:20px; margin-bottom:22px; font-family: Georgia, serif;">${label}</span>`;
}

function sectionTitle(text: string): string {
  return `<h2 style="margin:0 0 20px; font-size:21px; color:${brand.foreground}; font-family: Georgia, 'Times New Roman', serif; font-weight:normal; letter-spacing:-0.01em; border-bottom:1px solid ${brand.border}; padding-bottom:14px;">${text}</h2>`;
}

function ctaButton(href: string, label: string, color = brand.accent): string {
  return `
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin: 28px 0;">
      <tr>
        <td style="background-color:${color}; border-radius:7px; box-shadow: 0 2px 8px rgba(200,150,90,0.30);">
          <a href="${href}" style="display:inline-block; padding:14px 36px; color:${brand.white}; text-decoration:none; font-size:14px; font-family: Georgia, serif; letter-spacing:0.05em; font-weight:bold;">${label} &rarr;</a>
        </td>
      </tr>
    </table>
  `;
}

function secondaryLink(href: string, label: string): string {
  return `<p style="margin:0 0 24px; font-size:13px; font-family: Georgia, serif;"><a href="${href}" style="color:${brand.accent}; text-decoration:underline;">${label}</a></p>`;
}

function highlightBox(content: string, borderColor = brand.accent): string {
  return `
    <div style="background-color:${brand.accentLight}; border-left:3px solid ${borderColor}; padding:18px 22px; border-radius:0 8px 8px 0; margin:22px 0;">
      ${content}
    </div>
  `;
}

function infoRow(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:8px 0; color:${brand.muted}; font-size:13px; width:40%; vertical-align:top; font-family: Georgia, serif; border-bottom:1px solid rgba(217,208,197,0.5);">${label}</td>
      <td style="padding:8px 0; color:${brand.foreground}; font-size:14px; font-weight:bold; font-family: Georgia, serif; border-bottom:1px solid rgba(217,208,197,0.5);">${value}</td>
    </tr>
  `;
}

function detailsTable(rows: string): string {
  return `
    <table style="width:100%; border-collapse:collapse; font-family: Georgia, serif; margin: 20px 0;">
      ${rows}
    </table>
  `;
}

function signature(closing = "Warm regards"): string {
  return `
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:28px; border-top:1px solid ${brand.border}; padding-top:20px; width:100%;">
      <tr>
        <td>
          <p style="margin:0 0 4px; font-size:15px; color:${brand.foreground}; font-family: Georgia, serif;">${closing},</p>
          <p style="margin:0 0 2px; font-size:16px; color:${brand.primary}; font-weight:bold; font-family: Georgia, serif;">Maggi May Broussard</p>
          <p style="margin:0 0 6px; font-size:12px; color:${brand.muted}; font-family: Georgia, serif; letter-spacing:0.04em;">Licensed Paralegal · Louisiana &amp; Nationwide</p>
          <a href="mailto:maggimaybroussard@gmail.com" style="color:${brand.accent}; font-size:13px; text-decoration:none; font-family: Georgia, serif;">maggimaybroussard@gmail.com</a>
          &nbsp;<span style="color:${brand.border};">|</span>&nbsp;
          <a href="${SITE_URL}" style="color:${brand.accent}; font-size:13px; text-decoration:none; font-family: Georgia, serif;">maggimay.com</a>
        </td>
      </tr>
    </table>
  `;
}

function bodyText(text: string): string {
  return `<p style="margin:0 0 16px; font-size:15px; color:${brand.foreground}; line-height:1.8; font-family: Georgia, serif;">${text}</p>`;
}

function divider(): string {
  return `<div style="height:1px; background: linear-gradient(to right, ${brand.border}, transparent); margin: 24px 0;"></div>`;
}

// ─── Email Templates ──────────────────────────────────────────────────────────

function welcomeEmail(name: string, service: string, source: string): { subject: string; html: string } {
  const isChatbot = source === "chatbot";
  const firstName = name.split(" ")[0];

  const content = `
    ${badge("Welcome — Inquiry Received")}
    ${sectionTitle(`Thank you, ${firstName}`)}
    ${bodyText(`I've received your inquiry about <strong>${service}</strong>${isChatbot ? " through my website" : ""}. I'm genuinely excited to learn more about how I can support your practice and will personally follow up within one business day.`)}
    ${highlightBox(`
      <p style="margin:0 0 10px; font-size:12px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.1em; font-family: Georgia, serif;">Your inquiry summary</p>
      ${detailsTable(`
        ${infoRow("Service Requested", service)}
        ${infoRow("Response Time", "Within 1 business day")}
        ${infoRow("Consultation", "Free 30-minute call available")}
      `)}
    `)}
    ${bodyText(`Here's a quick overview of how I work with attorneys and law firms:`)}
    <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%; margin:0 0 20px; background-color:${brand.bgCard}; border:1px solid ${brand.border}; border-radius:8px; overflow:hidden;">
      <tr>
        <td style="padding:18px 22px; border-bottom:1px solid ${brand.border};">
          <p style="margin:0 0 4px; font-size:14px; color:${brand.primary}; font-weight:bold; font-family: Georgia, serif;">&#10003;&nbsp; Free Initial Consultation</p>
          <p style="margin:0; font-size:13px; color:${brand.muted}; font-family: Georgia, serif;">No commitment — just a conversation about your needs</p>
        </td>
      </tr>
      <tr>
        <td style="padding:18px 22px; border-bottom:1px solid ${brand.border};">
          <p style="margin:0 0 4px; font-size:14px; color:${brand.primary}; font-weight:bold; font-family: Georgia, serif;">&#10003;&nbsp; Flexible Engagement Models</p>
          <p style="margin:0; font-size:13px; color:${brand.muted}; font-family: Georgia, serif;">Hourly, project-based, or ongoing monthly retainer</p>
        </td>
      </tr>
      <tr>
        <td style="padding:18px 22px; border-bottom:1px solid ${brand.border};">
          <p style="margin:0 0 4px; font-size:14px; color:${brand.primary}; font-weight:bold; font-family: Georgia, serif;">&#10003;&nbsp; 100% Remote &amp; Seamless</p>
          <p style="margin:0; font-size:13px; color:${brand.muted}; font-family: Georgia, serif;">Integrates directly into your existing workflow</p>
        </td>
      </tr>
      <tr>
        <td style="padding:18px 22px;">
          <p style="margin:0 0 4px; font-size:14px; color:${brand.primary}; font-weight:bold; font-family: Georgia, serif;">&#10003;&nbsp; Nationwide Coverage</p>
          <p style="margin:0; font-size:13px; color:${brand.muted}; font-family: Georgia, serif;">Licensed and available to support firms across all 50 states</p>
        </td>
      </tr>
    </table>
    ${bodyText(`Don't want to wait? You can book a free 30-minute consultation directly on my calendar — no back-and-forth required.`)}
    ${ctaButton(`${SITE_URL}/availability`, "Book Your Free Consultation")}
    ${secondaryLink(`${SITE_URL}/services`, "Explore my services first &rarr;")}
    ${signature()}
  `;

  return {
    subject: `Your ${service} inquiry — I'll be in touch shortly`,
    html: emailWrapper(content, `Thank you for reaching out about ${service}. I'll follow up within one business day.`),
  };
}

function bookingReminderStep1(name: string, service: string): { subject: string; html: string } {
  const firstName = name.split(" ")[0];

  const content = `
    ${badge("Following Up")}
    ${sectionTitle(`Still thinking about ${service} support, ${firstName}?`)}
    ${bodyText(`I wanted to follow up on your recent inquiry. I know how busy things get — I just want to make sure you have everything you need to make a decision.`)}
    ${highlightBox(`
      <p style="margin:0 0 10px; font-size:13px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.08em; font-family: Georgia, serif;">Why attorneys choose to work with me</p>
      <p style="margin:0 0 8px; font-size:14px; color:${brand.foreground}; line-height:1.7; font-family: Georgia, serif;">
        &#8594;&nbsp; <strong>Immediate availability</strong> — I can typically start within a week of our first call
      </p>
      <p style="margin:0 0 8px; font-size:14px; color:${brand.foreground}; line-height:1.7; font-family: Georgia, serif;">
        &#8594;&nbsp; <strong>No long-term commitment required</strong> — start with a single project
      </p>
      <p style="margin:0; font-size:14px; color:${brand.foreground}; line-height:1.7; font-family: Georgia, serif;">
        &#8594;&nbsp; <strong>Specialized in ${service}</strong> — not a generalist, I know this area well
      </p>
    `)}
    ${bodyText(`A free 15-minute call is the easiest way to see if we're a good fit. No pressure, no obligation.`)}
    ${ctaButton(`${SITE_URL}/availability`, "Schedule a Free 15-Min Call")}
    ${secondaryLink(`${SITE_URL}/contact`, "Or send me a message instead &rarr;")}
    ${signature()}
  `;

  return {
    subject: `Following up on your ${service} inquiry, ${firstName}`,
    html: emailWrapper(content, `Quick follow-up on your ${service} inquiry — let's find a time to connect.`),
  };
}

function bookingReminderStep2(name: string, service: string): { subject: string; html: string } {
  const firstName = name.split(" ")[0];

  const content = `
    ${badge("One More Check-In")}
    ${sectionTitle(`${firstName}, I'm still here to help`)}
    ${bodyText(`I know things get busy — I just wanted to make sure my earlier note didn't get lost in the shuffle.`)}
    ${bodyText(`I specialize in <strong>${service}</strong> and work with attorneys and law firms across the country on a remote, flexible basis. Whether you need ongoing support or help with a single project, I can adapt to your workflow.`)}
    ${highlightBox(`
      <p style="margin:0 0 12px; font-size:12px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.1em; font-family: Georgia, serif;">What I can help with</p>
      <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
        <tr>
          <td style="padding:4px 0; font-size:14px; color:${brand.foreground}; font-family: Georgia, serif; width:50%;">&#9632;&nbsp; Litigation support</td>
          <td style="padding:4px 0; font-size:14px; color:${brand.foreground}; font-family: Georgia, serif;">&#9632;&nbsp; Document drafting</td>
        </tr>
        <tr>
          <td style="padding:4px 0; font-size:14px; color:${brand.foreground}; font-family: Georgia, serif;">&#9632;&nbsp; Contract review</td>
          <td style="padding:4px 0; font-size:14px; color:${brand.foreground}; font-family: Georgia, serif;">&#9632;&nbsp; Legal research</td>
        </tr>
        <tr>
          <td style="padding:4px 0; font-size:14px; color:${brand.foreground}; font-family: Georgia, serif;">&#9632;&nbsp; Case management</td>
          <td style="padding:4px 0; font-size:14px; color:${brand.foreground}; font-family: Georgia, serif;">&#9632;&nbsp; Deposition prep</td>
        </tr>
      </table>
    `)}
    ${ctaButton(`${SITE_URL}/availability`, "Book a Free Consultation")}
    ${secondaryLink(`${SITE_URL}/case-studies`, "See how I've helped similar firms &rarr;")}
    ${signature("Best")}
  `;

  return {
    subject: `Still here to help with your ${service} needs, ${firstName}`,
    html: emailWrapper(content, `One more check-in — I'd love to help with your ${service} work.`),
  };
}

function leadNurtureStep1(name: string, service: string): { subject: string; html: string } {
  const firstName = name.split(" ")[0];

  const content = `
    ${badge("Resource for You")}
    ${sectionTitle(`A quick insight on ${service}`)}
    ${bodyText(`Hi ${firstName}, I wanted to share something that might be useful as you evaluate your options.`)}
    ${bodyText(`Many attorneys I work with find that outsourcing <strong>${service}</strong> tasks — even on a project basis — frees up significant billable hours. The key is finding someone who integrates seamlessly into your workflow without a steep learning curve.`)}
    ${highlightBox(`
      <p style="margin:0 0 10px; font-size:13px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.08em; font-family: Georgia, serif;">The ROI of legal support outsourcing</p>
      <p style="margin:0 0 8px; font-size:14px; color:${brand.foreground}; line-height:1.7; font-family: Georgia, serif;">
        &#8594;&nbsp; Attorneys who outsource support tasks recover <strong>6–10 billable hours per week</strong>
      </p>
      <p style="margin:0 0 8px; font-size:14px; color:${brand.foreground}; line-height:1.7; font-family: Georgia, serif;">
        &#8594;&nbsp; Project-based engagements start at a <strong>fraction of full-time hire costs</strong>
      </p>
      <p style="margin:0; font-size:14px; color:${brand.foreground}; line-height:1.7; font-family: Georgia, serif;">
        &#8594;&nbsp; No onboarding overhead — I'm <strong>ready to contribute from day one</strong>
      </p>
    `)}
    ${bodyText(`I've worked with solo practitioners and mid-size firms alike. I'm happy to share how I've helped similar practices with <strong>${service}</strong> specifically.`)}
    ${ctaButton(`${SITE_URL}/case-studies`, "View Client Case Studies")}
    ${secondaryLink(`${SITE_URL}/availability`, "Or book a free call to discuss your needs &rarr;")}
    ${signature()}
  `;

  return {
    subject: `A resource for your ${service} work, ${firstName}`,
    html: emailWrapper(content, `Useful insight on outsourcing ${service} support — and how it could benefit your practice.`),
  };
}

function reengagementEmail(name: string, service: string): { subject: string; html: string } {
  const firstName = name.split(" ")[0];

  const content = `
    ${badge("Last Check-In")}
    ${sectionTitle(`${firstName}, is the timing better now?`)}
    ${bodyText(`I'll keep this brief — I know your time is valuable.`)}
    ${bodyText(`You reached out a few weeks ago about <strong>${service}</strong>. If the timing wasn't right then, I completely understand. If you're still exploring options, I'd love to connect.`)}
    ${highlightBox(`
      <p style="margin:0 0 8px; font-size:13px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.08em; font-family: Georgia, serif;">Current availability</p>
      <p style="margin:0 0 6px; font-size:14px; color:${brand.foreground}; line-height:1.7; font-family: Georgia, serif;">
        &#10003;&nbsp; Accepting new clients now
      </p>
      <p style="margin:0 0 6px; font-size:14px; color:${brand.foreground}; line-height:1.7; font-family: Georgia, serif;">
        &#10003;&nbsp; Can start within one week of our first call
      </p>
      <p style="margin:0; font-size:14px; color:${brand.foreground}; line-height:1.7; font-family: Georgia, serif;">
        &#10003;&nbsp; No long-term commitment required to get started
      </p>
    `)}
    ${ctaButton(`${SITE_URL}/availability`, "Let's Connect — Book a Free Call")}
    ${divider()}
    ${bodyText(`<span style="font-size:13px; color:${brand.muted};">If you'd prefer not to receive further emails, simply reply "unsubscribe" and I'll remove you immediately.</span>`)}
    ${signature("Best")}
  `;

  return {
    subject: `Last check-in — ${firstName}, still interested in ${service} support?`,
    html: emailWrapper(content, `Final check-in — if the timing is right now, I'd love to connect.`),
  };
}

// ─── Post-Service Follow-Up Templates ────────────────────────────────────────

function postServiceFollowupStep1(name: string, service: string): { subject: string; html: string } {
  const firstName = name.split(" ")[0];

  const content = `
    ${badge("Project Complete — Checking In", brand.green)}
    ${sectionTitle(`How did everything go, ${firstName}?`)}
    ${bodyText(`I hope everything went smoothly with your <strong>${service}</strong> matter. I wanted to personally check in and make sure you're satisfied with the work we completed together.`)}
    ${highlightBox(`
      <p style="margin:0 0 10px; font-size:13px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.08em; font-family: Georgia, serif;">Your feedback matters</p>
      <p style="margin:0; font-size:14px; color:${brand.foreground}; line-height:1.7; font-family: Georgia, serif;">
        Simply reply to this email with any thoughts — I read every response personally and use it to continually improve my service. If anything is outstanding or needs attention, I want to know right away.
      </p>
    `, brand.green)}
    ${bodyText(`If you have upcoming legal support needs — another project, ongoing assistance, or anything else — I'm here and ready to continue.`)}
    ${ctaButton(`${SITE_URL}/portal/login`, "Access Your Client Portal", brand.green)}
    ${secondaryLink(`${SITE_URL}/availability`, "Book a follow-up consultation &rarr;")}
    ${signature()}
  `;

  return {
    subject: `Checking in — how did everything go, ${firstName}?`,
    html: emailWrapper(content, `Quick check-in after your ${service} project — your feedback means a lot.`),
  };
}

function postServiceFollowupStep2(name: string, service: string): { subject: string; html: string } {
  const firstName = name.split(" ")[0];

  const content = `
    ${badge("Stay Connected")}
    ${sectionTitle(`${firstName}, a quick favor — and thank you`)}
    ${bodyText(`It's been a couple of weeks since we wrapped up your <strong>${service}</strong> work. I hope things are going well at your firm.`)}
    ${bodyText(`If you found our collaboration valuable, I'd be truly grateful if you'd consider one of the following:`)}
    <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%; margin:0 0 20px; background-color:${brand.bgCard}; border:1px solid ${brand.border}; border-radius:8px; overflow:hidden;">
      <tr>
        <td style="padding:18px 22px; border-bottom:1px solid ${brand.border};">
          <p style="margin:0 0 4px; font-size:14px; color:${brand.primary}; font-weight:bold; font-family: Georgia, serif;">&#9733;&nbsp; Leave a Testimonial</p>
          <p style="margin:0; font-size:13px; color:${brand.muted}; font-family: Georgia, serif;">A sentence or two helps other attorneys find the right support — and means the world to a small practice</p>
        </td>
      </tr>
      <tr>
        <td style="padding:18px 22px;">
          <p style="margin:0 0 4px; font-size:14px; color:${brand.primary}; font-weight:bold; font-family: Georgia, serif;">&#128101;&nbsp; Refer a Colleague</p>
          <p style="margin:0; font-size:13px; color:${brand.muted}; font-family: Georgia, serif;">Know another attorney who could use legal support? I offer a referral discount for new clients you send my way</p>
        </td>
      </tr>
    </table>
    ${bodyText(`And whenever you have new legal support needs — whether it's another project or ongoing assistance — I'm here and ready to help.`)}
    ${ctaButton(`${SITE_URL}/contact`, "Start a New Project")}
    ${secondaryLink(`${SITE_URL}/portal/login`, "Access your client portal &rarr;")}
    ${signature("With gratitude")}
  `;

  return {
    subject: `${firstName}, a quick favor — and thank you`,
    html: emailWrapper(content, `A small ask after your ${service} project — and an open door for future work.`),
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
    const { sequenceId, inquiryId, sequenceType, stepNumber, recipientEmail, recipientName, service, source } =
      await req.json();

    const RESEND_API_KEY = (globalThis as any)?.Deno?.env?.get("RESEND_API_KEY");
    const SUPABASE_URL = (globalThis as any)?.Deno?.env?.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = (globalThis as any)?.Deno?.env?.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");

    // Pick the right template
    let template: { subject: string; html: string };
    if (sequenceType === "welcome") {
      template = welcomeEmail(recipientName, service, source || "contact_form");
    } else if (sequenceType === "booking_reminder" && stepNumber === 1) {
      template = bookingReminderStep1(recipientName, service);
    } else if (sequenceType === "booking_reminder" && stepNumber === 2) {
      template = bookingReminderStep2(recipientName, service);
    } else if (sequenceType === "lead_nurture") {
      template = leadNurtureStep1(recipientName, service);
    } else if (sequenceType === "reengagement") {
      template = reengagementEmail(recipientName, service);
    } else if (sequenceType === "post_service_followup" && stepNumber === 2) {
      template = postServiceFollowupStep2(recipientName, service);
    } else if (sequenceType === "post_service_followup") {
      template = postServiceFollowupStep1(recipientName, service);
    } else {
      template = bookingReminderStep1(recipientName, service);
    }

    // Send via Resend
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "maggimay@broussardlegalservices.com",
        to: [recipientEmail],
        subject: template.subject,
        html: template.html,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Resend API error");
    }

    // Update sequence step status in Supabase (email_sequences table)
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && sequenceId) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        await supabase
          .from("email_sequences")
          .update({
            send_status: "sent",
            sent_at: new Date().toISOString(),
            resend_email_id: data.id ?? null,
          })
          .eq("id", sequenceId);
      } catch {
        // Non-blocking
      }
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    // Mark sequence as failed if we have the ID
    try {
      const body = await (async () => {
        try { return await (req as any).json?.(); } catch { return {}; }
      })();
      const SUPABASE_URL = (globalThis as any)?.Deno?.env?.get("SUPABASE_URL");
      const SUPABASE_SERVICE_ROLE_KEY = (globalThis as any)?.Deno?.env?.get("SUPABASE_SERVICE_ROLE_KEY");
      if (body?.sequenceId && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        await supabase
          .from("email_sequences")
          .update({ send_status: "failed", error_message: error.message })
          .eq("id", body.sequenceId);
      }
    } catch {
      // Non-blocking
    }

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
