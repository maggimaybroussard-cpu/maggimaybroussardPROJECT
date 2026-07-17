import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Sends one step of the Calendly booking confirmation email sequence.
 *
 * Step 1 — Immediate: Booking confirmation details (date, time, location, reschedule link)
 * Step 2 — Day 1:    Consultation prep instructions (what to bring, what to expect)
 * Step 3 — Day 3:    Client portal access info (login, dashboard, documents, invoices)
 */

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
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="x-apple-disable-message-reformatting">
      <title>Maggi May Broussard Legal Services</title>
      ${preheader ? `<!--[if !mso]><!-->
      <div style="display:none;font-size:1px;color:#fefefe;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</div>
      <!--<![endif]-->` : ""}
    </head>
    <body style="margin:0; padding:0; background-color:#EDE8E0; font-family: Georgia, 'Times New Roman', serif; -webkit-text-size-adjust:100%;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#EDE8E0; padding: 40px 16px;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px; width:100%; background-color:${brand.bg}; border-radius:14px; overflow:hidden; border: 1px solid ${brand.border}; box-shadow: 0 4px 24px rgba(74,55,40,0.10);">

            <!-- BRANDED HEADER -->
            <tr>
              <td style="background-color:${brand.primary}; padding: 0;">
                <div style="height:4px; background: linear-gradient(to right, ${brand.accent}, #E8B87A, ${brand.accent});"></div>
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="padding: 28px 36px 24px;">
                  <tr>
                    <td>
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
                <div style="height:1px; background: linear-gradient(to right, ${brand.accent}, rgba(200,150,90,0.2), transparent); margin: 0 36px;"></div>
                <div style="height:20px;"></div>
              </td>
            </tr>

            <!-- BODY -->
            <tr>
              <td style="padding: 36px 36px 32px;">
                ${content}
              </td>
            </tr>

            <!-- FOOTER -->
            <tr>
              <td style="background-color:${brand.secondary}; padding: 20px 36px; border-top: 1px solid ${brand.border};">
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                  <tr>
                    <td>
                      <p style="margin:0 0 6px; font-size:12px; color:${brand.primary}; font-weight:bold; font-family: Georgia, serif; letter-spacing:0.04em;">Maggi May Broussard Legal Services</p>
                      <p style="margin:0; font-size:11px; color:${brand.muted}; line-height:1.7;">
                        You received this because you booked a consultation at maggimay.com.
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
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin: 24px 0;">
      <tr>
        <td style="background-color:${color}; border-radius:7px; box-shadow: 0 2px 8px rgba(200,150,90,0.30);">
          <a href="${href}" style="display:inline-block; padding:14px 36px; color:${brand.white}; text-decoration:none; font-size:14px; font-family: Georgia, serif; letter-spacing:0.05em; font-weight:bold;">${label} &rarr;</a>
        </td>
      </tr>
    </table>
  `;
}

function bodyText(text: string): string {
  return `<p style="margin:0 0 16px; font-size:15px; color:${brand.foreground}; line-height:1.8; font-family: Georgia, serif;">${text}</p>`;
}

function signature(closing = "Warm regards"): string {
  return `
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:28px; border-top:1px solid ${brand.border}; padding-top:20px; width:100%;">
      <tr>
        <td>
          <p style="margin:0 0 4px; font-size:15px; color:${brand.foreground}; font-family: Georgia, serif;">${closing},</p>
          <p style="margin:0 0 2px; font-size:16px; color:${brand.primary}; font-weight:bold; font-family: Georgia, serif;">Maggi May Broussard</p>
          <p style="margin:0 0 6px; font-size:12px; color:${brand.muted}; font-family: Georgia, serif; letter-spacing:0.04em;">Broussard Legal Services</p>
          <a href="mailto:maggimaybroussard@gmail.com" style="color:${brand.accent}; font-size:13px; text-decoration:none; font-family: Georgia, serif;">maggimaybroussard@gmail.com</a>
          &nbsp;<span style="color:${brand.border};">|</span>&nbsp;
          <a href="${SITE_URL}" style="color:${brand.accent}; font-size:13px; text-decoration:none; font-family: Georgia, serif;">maggimay.com</a>
        </td>
      </tr>
    </table>
  `;
}

// ─── Email Templates ──────────────────────────────────────────────────────────

/**
 * Step 1 — Immediate: Booking Confirmation Details
 */
function step1ConfirmationEmail(
  name: string,
  eventName: string,
  eventDate: string,
  eventTime: string,
  meetingLocation: string
): { subject: string; html: string } {
  const firstName = name.split(" ")[0];

  const content = `
    ${badge("&#10003; Booking Confirmed")}
    ${sectionTitle(`Your consultation is confirmed, ${firstName}`)}
    ${bodyText(`Thank you for scheduling a consultation with Maggi May Broussard Legal Services. I look forward to speaking with you and helping you navigate your legal support needs.`)}

    <!-- Appointment Details Card -->
    <div style="background-color:${brand.bgCard}; border:1px solid ${brand.border}; border-radius:10px; overflow:hidden; margin:0 0 24px;">
      <div style="background-color:${brand.primary}; padding:12px 22px;">
        <p style="margin:0; font-size:11px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.12em; font-family: Georgia, serif;">&#128197; Appointment Details</p>
      </div>
      <div style="padding:20px 22px;">
        <table style="width:100%; border-collapse:collapse; font-family: Georgia, serif;">
          <tr>
            <td style="padding:10px 0; color:${brand.muted}; font-size:13px; width:38%; border-bottom:1px solid rgba(217,208,197,0.5); vertical-align:top;">Consultation</td>
            <td style="padding:10px 0; color:${brand.foreground}; font-size:14px; font-weight:bold; border-bottom:1px solid rgba(217,208,197,0.5);">${eventName}</td>
          </tr>
          <tr>
            <td style="padding:10px 0; color:${brand.muted}; font-size:13px; border-bottom:1px solid rgba(217,208,197,0.5); vertical-align:top;">Date</td>
            <td style="padding:10px 0; color:${brand.foreground}; font-size:14px; font-weight:bold; border-bottom:1px solid rgba(217,208,197,0.5);">${eventDate}</td>
          </tr>
          ${eventTime ? `
          <tr>
            <td style="padding:10px 0; color:${brand.muted}; font-size:13px; border-bottom:1px solid rgba(217,208,197,0.5); vertical-align:top;">Time</td>
            <td style="padding:10px 0; color:${brand.foreground}; font-size:14px; font-weight:bold; border-bottom:1px solid rgba(217,208,197,0.5);">${eventTime}</td>
          </tr>` : ""}
          ${meetingLocation ? `
          <tr>
            <td style="padding:10px 0; color:${brand.muted}; font-size:13px; vertical-align:top;">Location</td>
            <td style="padding:10px 0; color:${brand.foreground}; font-size:14px; line-height:1.6;">${meetingLocation}</td>
          </tr>` : ""}
        </table>
      </div>
    </div>

    <!-- What Happens Next -->
    <div style="background-color:${brand.accentLight}; border-left:3px solid ${brand.accent}; padding:18px 22px; border-radius:0 8px 8px 0; margin:0 0 24px;">
      <p style="margin:0 0 10px; font-size:12px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.1em; font-family: Georgia, serif;">What Happens Next</p>
      <p style="margin:0 0 8px; font-size:14px; color:${brand.foreground}; line-height:1.7; font-family: Georgia, serif;">
        &#8594;&nbsp; A calendar invite has been sent to your email address
      </p>
      <p style="margin:0 0 8px; font-size:14px; color:${brand.foreground}; line-height:1.7; font-family: Georgia, serif;">
        &#8594;&nbsp; You'll receive a prep guide tomorrow with everything to bring
      </p>
      <p style="margin:0; font-size:14px; color:${brand.foreground}; line-height:1.7; font-family: Georgia, serif;">
        &#8594;&nbsp; Your client portal access details will follow within 3 days
      </p>
    </div>

    <!-- Reschedule Notice -->
    <div style="background-color:${brand.bgCard}; border:1px solid ${brand.border}; border-radius:8px; padding:18px 22px; margin:0 0 24px;">
      <p style="margin:0 0 6px; font-size:12px; color:${brand.muted}; font-weight:bold; text-transform:uppercase; letter-spacing:0.1em; font-family: Georgia, serif;">Need to Reschedule or Cancel?</p>
      <p style="margin:0; font-size:14px; color:${brand.foreground}; line-height:1.7; font-family: Georgia, serif;">
        Use the link in your Calendly confirmation email to reschedule or cancel at any time. Please provide at least 24 hours' notice when possible.
      </p>
    </div>

    ${ctaButton(`${SITE_URL}/services`, "Review My Services")}

    ${signature()}
  `;

  return {
    subject: `Consultation Confirmed — ${eventDate}`,
    html: emailWrapper(content, `Your consultation on ${eventDate} is confirmed. Here's everything you need to know.`),
  };
}

/**
 * Step 2 — Day 1: Consultation Prep Instructions
 */
function step2PrepInstructionsEmail(
  name: string,
  eventName: string,
  eventDate: string
): { subject: string; html: string } {
  const firstName = name.split(" ")[0];

  const content = `
    ${badge("&#128203; Consultation Prep Guide")}
    ${sectionTitle(`Get ready for your consultation, ${firstName}`)}
    ${bodyText(`Your consultation — <strong>${eventName}</strong> on <strong>${eventDate}</strong> — is coming up soon. Here's everything you need to prepare so we can make the most of our time together.`)}

    <!-- Prep Checklist -->
    <div style="background-color:${brand.bgCard}; border:1px solid ${brand.border}; border-radius:10px; overflow:hidden; margin:0 0 24px;">
      <div style="background-color:${brand.primary}; padding:12px 22px;">
        <p style="margin:0; font-size:11px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.12em; font-family: Georgia, serif;">&#9989; Pre-Consultation Checklist</p>
      </div>
      <div style="padding:20px 22px;">
        <table style="width:100%; border-collapse:collapse; font-family: Georgia, serif;">
          <tr>
            <td style="padding:12px 0; border-bottom:1px solid rgba(217,208,197,0.5); vertical-align:top;">
              <p style="margin:0 0 4px; font-size:14px; color:${brand.foreground}; font-weight:bold;">&#9744;&nbsp; Gather Relevant Documents</p>
              <p style="margin:0; font-size:12px; color:${brand.muted}; line-height:1.6;">Contracts, correspondence, court filings, or any paperwork related to your matter. Scanned copies or photos are fine.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 0; border-bottom:1px solid rgba(217,208,197,0.5); vertical-align:top;">
              <p style="margin:0 0 4px; font-size:14px; color:${brand.foreground}; font-weight:bold;">&#9744;&nbsp; Write a Brief Timeline</p>
              <p style="margin:0; font-size:12px; color:${brand.muted}; line-height:1.6;">A short chronological summary of key events — dates, what happened, and who was involved. Even a few bullet points help.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 0; border-bottom:1px solid rgba(217,208,197,0.5); vertical-align:top;">
              <p style="margin:0 0 4px; font-size:14px; color:${brand.foreground}; font-weight:bold;">&#9744;&nbsp; List Your Questions</p>
              <p style="margin:0; font-size:12px; color:${brand.muted}; line-height:1.6;">Write down everything you want to ask or clarify. No question is too small — this is your time.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 0; border-bottom:1px solid rgba(217,208,197,0.5); vertical-align:top;">
              <p style="margin:0 0 4px; font-size:14px; color:${brand.foreground}; font-weight:bold;">&#9744;&nbsp; Note Any Deadlines</p>
              <p style="margin:0; font-size:12px; color:${brand.muted}; line-height:1.6;">Court dates, filing deadlines, response windows, or any time-sensitive matters that need immediate attention.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 0; vertical-align:top;">
              <p style="margin:0 0 4px; font-size:14px; color:${brand.foreground}; font-weight:bold;">&#9744;&nbsp; Test Your Connection</p>
              <p style="margin:0; font-size:12px; color:${brand.muted}; line-height:1.6;">If we're meeting virtually, test your video/audio 10 minutes before. Join from a quiet, private space.</p>
            </td>
          </tr>
        </table>
      </div>
    </div>

    <!-- What to Expect -->
    <div style="background-color:${brand.bgCard}; border:1px solid ${brand.border}; border-radius:10px; overflow:hidden; margin:0 0 24px;">
      <div style="background-color:${brand.primary}; padding:12px 22px;">
        <p style="margin:0; font-size:11px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.12em; font-family: Georgia, serif;">&#128161; What to Expect During Our Call</p>
      </div>
      <div style="padding:20px 22px;">
        <table style="width:100%; border-collapse:collapse; font-family: Georgia, serif;">
          <tr>
            <td style="padding:10px 0; border-bottom:1px solid rgba(217,208,197,0.5); vertical-align:top; width:32px;">
              <div style="width:26px; height:26px; background-color:${brand.accent}; border-radius:50%; text-align:center; line-height:26px; color:${brand.white}; font-size:12px; font-weight:bold; font-family: Georgia, serif;">1</div>
            </td>
            <td style="padding:10px 0 10px 14px; border-bottom:1px solid rgba(217,208,197,0.5); vertical-align:top;">
              <p style="margin:0 0 3px; font-size:14px; color:${brand.foreground}; font-weight:bold;">Introductions &amp; Overview (5 min)</p>
              <p style="margin:0; font-size:12px; color:${brand.muted}; line-height:1.6;">We'll get acquainted and you'll share a brief overview of your situation.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0; border-bottom:1px solid rgba(217,208,197,0.5); vertical-align:top;">
              <div style="width:26px; height:26px; background-color:${brand.accent}; border-radius:50%; text-align:center; line-height:26px; color:${brand.white}; font-size:12px; font-weight:bold; font-family: Georgia, serif;">2</div>
            </td>
            <td style="padding:10px 0 10px 14px; border-bottom:1px solid rgba(217,208,197,0.5); vertical-align:top;">
              <p style="margin:0 0 3px; font-size:14px; color:${brand.foreground}; font-weight:bold;">Deep Dive &amp; Document Review (15 min)</p>
              <p style="margin:0; font-size:12px; color:${brand.muted}; line-height:1.6;">I'll review any documents you've shared and ask clarifying questions about your matter.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0; vertical-align:top;">
              <div style="width:26px; height:26px; background-color:${brand.accent}; border-radius:50%; text-align:center; line-height:26px; color:${brand.white}; font-size:12px; font-weight:bold; font-family: Georgia, serif;">3</div>
            </td>
            <td style="padding:10px 0 10px 14px; vertical-align:top;">
              <p style="margin:0 0 3px; font-size:14px; color:${brand.foreground}; font-weight:bold;">Recommendations &amp; Next Steps (10 min)</p>
              <p style="margin:0; font-size:12px; color:${brand.muted}; line-height:1.6;">I'll outline how I can assist, answer your questions, and discuss engagement options.</p>
            </td>
          </tr>
        </table>
      </div>
    </div>

    <!-- Upload Tip -->
    <div style="background-color:${brand.accentLight}; border-left:3px solid ${brand.accent}; padding:18px 22px; border-radius:0 8px 8px 0; margin:0 0 24px;">
      <p style="margin:0 0 8px; font-size:12px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.1em; font-family: Georgia, serif;">&#128196; Upload Documents Before We Meet</p>
      <p style="margin:0 0 12px; font-size:14px; color:${brand.foreground}; line-height:1.7; font-family: Georgia, serif;">
        Save time during our call by uploading your documents to your secure client portal beforehand. I'll review them in advance so we can focus on strategy.
      </p>
      <p style="margin:0; font-size:13px; color:${brand.muted}; font-family: Georgia, serif;">Accepted: PDF, Word, Excel, JPEG, PNG (max 10MB each)</p>
    </div>

    ${ctaButton(`${SITE_URL}/portal/documents`, "Upload Documents to My Portal")}

    ${bodyText(`Don't stress if you can't gather everything — we'll work with whatever you have. The goal is simply to make our time together as productive as possible.`)}

    ${signature("See you soon")}
  `;

  return {
    subject: `Your Consultation Prep Guide — ${eventDate}`,
    html: emailWrapper(content, `Your consultation is tomorrow. Here's your prep guide and what to expect.`),
  };
}

/**
 * Step 3 — Day 3: Client Portal Access Info
 */
function step3PortalAccessEmail(
  name: string,
  eventDate: string
): { subject: string; html: string } {
  const firstName = name.split(" ")[0];

  const content = `
    ${badge("&#128274; Your Client Portal Access")}
    ${sectionTitle(`Your portal is ready, ${firstName}`)}
    ${bodyText(`As your consultation on <strong>${eventDate}</strong> approaches, I want to make sure you have full access to your secure client portal — your central hub for everything related to your case.`)}

    <!-- Portal Features -->
    <div style="background-color:${brand.bgCard}; border:1px solid ${brand.border}; border-radius:10px; overflow:hidden; margin:0 0 24px;">
      <div style="background-color:${brand.primary}; padding:12px 22px;">
        <p style="margin:0; font-size:11px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.12em; font-family: Georgia, serif;">&#127968; What's Inside Your Portal</p>
      </div>
      <div style="padding:0;">

        <!-- Dashboard -->
        <div style="padding:18px 22px; border-bottom:1px solid ${brand.border};">
          <table style="width:100%; font-family: Georgia, serif;">
            <tr>
              <td style="vertical-align:top; width:44px;">
                <div style="width:36px; height:36px; background-color:${brand.accentLight}; border-radius:8px; text-align:center; line-height:36px; font-size:18px;">&#128202;</div>
              </td>
              <td style="padding-left:14px; vertical-align:top;">
                <p style="margin:0 0 4px; font-size:14px; color:${brand.foreground}; font-weight:bold;">Case Dashboard</p>
                <p style="margin:0; font-size:13px; color:${brand.muted}; line-height:1.6;">Track your case milestones, upcoming deadlines, payment status, and invoice history — all in one unified view.</p>
              </td>
            </tr>
          </table>
        </div>

        <!-- Documents -->
        <div style="padding:18px 22px; border-bottom:1px solid ${brand.border};">
          <table style="width:100%; font-family: Georgia, serif;">
            <tr>
              <td style="vertical-align:top; width:44px;">
                <div style="width:36px; height:36px; background-color:${brand.accentLight}; border-radius:8px; text-align:center; line-height:36px; font-size:18px;">&#128196;</div>
              </td>
              <td style="padding-left:14px; vertical-align:top;">
                <p style="margin:0 0 4px; font-size:14px; color:${brand.foreground}; font-weight:bold;">Secure Document Storage</p>
                <p style="margin:0; font-size:13px; color:${brand.muted}; line-height:1.6;">Upload, organize, and download case documents by folder — Intake Forms, Evidence, Correspondence, Agreements, and more.</p>
              </td>
            </tr>
          </table>
        </div>

        <!-- Invoices -->
        <div style="padding:18px 22px; border-bottom:1px solid ${brand.border};">
          <table style="width:100%; font-family: Georgia, serif;">
            <tr>
              <td style="vertical-align:top; width:44px;">
                <div style="width:36px; height:36px; background-color:${brand.accentLight}; border-radius:8px; text-align:center; line-height:36px; font-size:18px;">&#128179;</div>
              </td>
              <td style="padding-left:14px; vertical-align:top;">
                <p style="margin:0 0 4px; font-size:14px; color:${brand.foreground}; font-weight:bold;">Invoices &amp; Payments</p>
                <p style="margin:0; font-size:13px; color:${brand.muted}; line-height:1.6;">View all invoices, payment history, and outstanding balances. Pay deposits or retainers directly from your portal.</p>
              </td>
            </tr>
          </table>
        </div>

        <!-- Cases -->
        <div style="padding:18px 22px;">
          <table style="width:100%; font-family: Georgia, serif;">
            <tr>
              <td style="vertical-align:top; width:44px;">
                <div style="width:36px; height:36px; background-color:${brand.accentLight}; border-radius:8px; text-align:center; line-height:36px; font-size:18px;">&#9878;&#65039;</div>
              </td>
              <td style="padding-left:14px; vertical-align:top;">
                <p style="margin:0 0 4px; font-size:14px; color:${brand.foreground}; font-weight:bold;">Case Timeline &amp; Updates</p>
                <p style="margin:0; font-size:13px; color:${brand.muted}; line-height:1.6;">Stay informed with a real-time timeline of your case progress, key events, and status updates from my team.</p>
              </td>
            </tr>
          </table>
        </div>

      </div>
    </div>

    <!-- Login Instructions -->
    <div style="background-color:${brand.bgCard}; border:1px solid ${brand.border}; border-radius:10px; overflow:hidden; margin:0 0 24px;">
      <div style="background-color:${brand.primary}; padding:12px 22px;">
        <p style="margin:0; font-size:11px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.12em; font-family: Georgia, serif;">&#128272; How to Access Your Portal</p>
      </div>
      <div style="padding:20px 22px;">
        <table style="width:100%; border-collapse:collapse; font-family: Georgia, serif;">
          <tr>
            <td style="padding:10px 0; border-bottom:1px solid rgba(217,208,197,0.5); vertical-align:top;">
              <p style="margin:0 0 3px; font-size:14px; color:${brand.foreground}; font-weight:bold;">Step 1 — Visit the Portal Login</p>
              <p style="margin:0; font-size:13px; color:${brand.muted}; line-height:1.6;">Go to <a href="${SITE_URL}/portal/login" style="color:${brand.accent}; text-decoration:none;">${SITE_URL}/portal/login</a></p>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0; border-bottom:1px solid rgba(217,208,197,0.5); vertical-align:top;">
              <p style="margin:0 0 3px; font-size:14px; color:${brand.foreground}; font-weight:bold;">Step 2 — Sign In with Your Email</p>
              <p style="margin:0; font-size:13px; color:${brand.muted}; line-height:1.6;">Use the email address you booked with. A magic link will be sent to your inbox — no password required.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0; vertical-align:top;">
              <p style="margin:0 0 3px; font-size:14px; color:${brand.foreground}; font-weight:bold;">Step 3 — Explore Your Dashboard</p>
              <p style="margin:0; font-size:13px; color:${brand.muted}; line-height:1.6;">Once logged in, you'll see your case dashboard, documents, invoices, and case timeline.</p>
            </td>
          </tr>
        </table>
      </div>
    </div>

    <!-- Primary CTA -->
    ${ctaButton(`${SITE_URL}/portal/login`, "Access My Client Portal", brand.primary)}

    <!-- Support Note -->
    <div style="background-color:${brand.accentLight}; border-left:3px solid ${brand.accent}; padding:16px 22px; border-radius:0 8px 8px 0; margin:0 0 24px;">
      <p style="margin:0 0 6px; font-size:12px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.1em; font-family: Georgia, serif;">Questions Before Our Call?</p>
      <p style="margin:0; font-size:14px; color:${brand.foreground}; line-height:1.7; font-family: Georgia, serif;">
        Reply to this email or reach me at <a href="mailto:maggimaybroussard@gmail.com" style="color:${brand.accent}; text-decoration:none;">maggimaybroussard@gmail.com</a>. I'm happy to answer any questions before we meet.
      </p>
    </div>

    ${bodyText(`I'm looking forward to our consultation and to helping you move forward with confidence.`)}

    ${signature("Looking forward to meeting you")}
  `;

  return {
    subject: `Your Client Portal Is Ready — Access It Before Our Call`,
    html: emailWrapper(content, `Your secure client portal is ready. Log in to track your case, upload documents, and manage invoices.`),
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
      eventName,
      startTime,
      timezone,
      meetingLocation,
    } = await req.json();

    const RESEND_API_KEY = (globalThis as any)?.Deno?.env?.get("RESEND_API_KEY");
    const SUPABASE_URL = (globalThis as any)?.Deno?.env?.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = (globalThis as any)?.Deno?.env?.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");

    // Format date/time for display
    const tz = timezone ?? "America/Chicago";
    const eventDate = startTime
      ? new Date(startTime).toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          timeZone: tz,
        })
      : "To be confirmed";

    const eventTime = startTime
      ? new Date(startTime).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          timeZoneName: "short",
          timeZone: tz,
        })
      : "";

    const resolvedEventName = eventName ?? "30-Minute Consultation";
    const resolvedLocation = meetingLocation ?? "";

    // Build the email for the requested step
    let emailData: { subject: string; html: string };

    if (stepNumber === 1) {
      emailData = step1ConfirmationEmail(
        recipientName,
        resolvedEventName,
        eventDate,
        eventTime,
        resolvedLocation
      );
    } else if (stepNumber === 2) {
      emailData = step2PrepInstructionsEmail(
        recipientName,
        resolvedEventName,
        eventDate
      );
    } else if (stepNumber === 3) {
      emailData = step3PortalAccessEmail(recipientName, eventDate);
    } else {
      throw new Error(`Invalid stepNumber: ${stepNumber}`);
    }

    // Send via Resend
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "maggimay@broussardlegalservices.com",
        to: [recipientEmail],
        subject: emailData.subject,
        html: emailData.html,
      }),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.json();
      throw new Error(errBody.message || "Resend API error");
    }

    const resendData = await resendRes.json();

    // Update sequence row status if sequenceId and Supabase creds provided
    if (sequenceId && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      await supabase
        .from("email_sequences")
        .update({ send_status: "sent", sent_at: new Date().toISOString() })
        .eq("id", sequenceId);
    }

    return new Response(
      JSON.stringify({ success: true, step: stepNumber, emailId: resendData.id }),
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
