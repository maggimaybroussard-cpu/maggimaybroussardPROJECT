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
          <p style="margin:0 0 6px; font-size:12px; color:${brand.muted}; font-family: Georgia, serif; letter-spacing:0.04em;">Licensed Paralegal · Louisiana &amp; Nationwide</p>
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
 * Step 1 — Immediate: Document Checklist
 * Sent right after booking to help clients prepare for the consultation.
 */
function documentChecklistEmail(name: string, service: string, eventDate: string): { subject: string; html: string } {
  const firstName = name.split(" ")[0];

  const content = `
    ${badge("&#128203; Case Kickoff — Document Checklist")}
    ${sectionTitle(`Let's get your case started, ${firstName}`)}
    ${bodyText(`Your consultation is confirmed for <strong>${eventDate}</strong>. To make the most of our time together, I've put together a document checklist tailored to your <strong>${service}</strong> needs.`)}
    ${bodyText(`Gathering these materials before our call will allow us to hit the ground running and give you the clearest picture of your options.`)}

    <!-- Document Checklist Card -->
    <div style="background-color:${brand.bgCard}; border:1px solid ${brand.border}; border-radius:10px; overflow:hidden; margin:0 0 24px;">
      <div style="background-color:${brand.primary}; padding:12px 22px;">
        <p style="margin:0; font-size:11px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.12em; font-family: Georgia, serif;">&#128196; Documents to Gather</p>
      </div>
      <div style="padding:20px 22px;">
        <table style="width:100%; border-collapse:collapse; font-family: Georgia, serif;">
          <tr>
            <td style="padding:10px 0; border-bottom:1px solid rgba(217,208,197,0.5); vertical-align:top;">
              <p style="margin:0 0 3px; font-size:14px; color:${brand.foreground}; font-weight:bold;">&#9744;&nbsp; Government-Issued ID</p>
              <p style="margin:0; font-size:12px; color:${brand.muted};">Driver's license, passport, or state ID</p>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0; border-bottom:1px solid rgba(217,208,197,0.5); vertical-align:top;">
              <p style="margin:0 0 3px; font-size:14px; color:${brand.foreground}; font-weight:bold;">&#9744;&nbsp; Relevant Contracts or Agreements</p>
              <p style="margin:0; font-size:12px; color:${brand.muted};">Any signed documents related to your matter</p>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0; border-bottom:1px solid rgba(217,208,197,0.5); vertical-align:top;">
              <p style="margin:0 0 3px; font-size:14px; color:${brand.foreground}; font-weight:bold;">&#9744;&nbsp; Correspondence &amp; Communications</p>
              <p style="margin:0; font-size:12px; color:${brand.muted};">Emails, letters, or notices from opposing parties or courts</p>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0; border-bottom:1px solid rgba(217,208,197,0.5); vertical-align:top;">
              <p style="margin:0 0 3px; font-size:14px; color:${brand.foreground}; font-weight:bold;">&#9744;&nbsp; Court Filings or Case Numbers</p>
              <p style="margin:0; font-size:12px; color:${brand.muted};">If your matter involves existing litigation</p>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0; border-bottom:1px solid rgba(217,208,197,0.5); vertical-align:top;">
              <p style="margin:0 0 3px; font-size:14px; color:${brand.foreground}; font-weight:bold;">&#9744;&nbsp; Financial Records (if applicable)</p>
              <p style="margin:0; font-size:12px; color:${brand.muted};">Bank statements, invoices, or payment records</p>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0; vertical-align:top;">
              <p style="margin:0 0 3px; font-size:14px; color:${brand.foreground}; font-weight:bold;">&#9744;&nbsp; Timeline of Key Events</p>
              <p style="margin:0; font-size:12px; color:${brand.muted};">A brief written summary of dates and what happened</p>
            </td>
          </tr>
        </table>
      </div>
    </div>

    <!-- Upload CTA -->
    <div style="background-color:${brand.accentLight}; border-left:3px solid ${brand.accent}; padding:18px 22px; border-radius:0 8px 8px 0; margin:0 0 24px;">
      <p style="margin:0 0 8px; font-size:12px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.1em; font-family: Georgia, serif;">Secure Document Upload</p>
      <p style="margin:0 0 12px; font-size:14px; color:${brand.foreground}; line-height:1.7; font-family: Georgia, serif;">
        You can upload documents securely through your client portal before our call. All files are encrypted and accessible only to you and my team.
      </p>
      <p style="margin:0; font-size:13px; color:${brand.muted}; font-family: Georgia, serif;">
        &#8594;&nbsp; Accepted formats: PDF, Word, Excel, JPEG, PNG (max 10MB each)
      </p>
    </div>

    ${ctaButton(`${SITE_URL}/portal/cases`, "Upload Documents in My Portal")}

    ${bodyText(`Don't worry if you can't gather everything before our call — we can work with whatever you have. The checklist is simply a guide to help you feel prepared.`)}

    ${signature()}
  `;

  return {
    subject: `Case Kickoff: Your Document Checklist — ${service}`,
    html: emailWrapper(content, `Your consultation is confirmed. Here's what to prepare before we meet.`),
  };
}

/**
 * Step 2 — Day 1: Retainer Confirmation & Engagement Options
 * Sent 24 hours after booking to present retainer/payment options.
 */
function retainerConfirmationEmail(name: string, service: string): { subject: string; html: string } {
  const firstName = name.split(" ")[0];

  const content = `
    ${badge("&#128179; Retainer &amp; Engagement Options")}
    ${sectionTitle(`Secure your case, ${firstName}`)}
    ${bodyText(`Your consultation is coming up soon. I wanted to take a moment to walk you through your engagement options so you can hit the ground running the moment we finish our call.`)}

    <!-- Engagement Options -->
    <div style="background-color:${brand.bgCard}; border:1px solid ${brand.border}; border-radius:10px; overflow:hidden; margin:0 0 24px;">
      <div style="background-color:${brand.primary}; padding:12px 22px;">
        <p style="margin:0; font-size:11px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.12em; font-family: Georgia, serif;">&#128203; Engagement Options for ${service}</p>
      </div>
      <div style="padding:0;">

        <!-- Option 1: Consultation Deposit -->
        <div style="padding:20px 22px; border-bottom:1px solid ${brand.border};">
          <table style="width:100%; font-family: Georgia, serif;">
            <tr>
              <td style="vertical-align:top; width:60%;">
                <p style="margin:0 0 4px; font-size:15px; color:${brand.foreground}; font-weight:bold;">Consultation Deposit</p>
                <p style="margin:0 0 8px; font-size:12px; color:${brand.muted};">Applied toward your first invoice</p>
                <p style="margin:0; font-size:13px; color:${brand.foreground}; line-height:1.6;">Formally holds your appointment slot and confirms your commitment to moving forward.</p>
              </td>
              <td style="vertical-align:top; text-align:right; padding-left:16px;">
                <p style="margin:0; font-size:22px; color:${brand.primary}; font-weight:bold; font-family: Georgia, serif;">$150</p>
                <p style="margin:4px 0 0; font-size:11px; color:${brand.muted};">one-time</p>
              </td>
            </tr>
          </table>
        </div>

        <!-- Option 2: Monthly Retainer -->
        <div style="padding:20px 22px; border-bottom:1px solid ${brand.border}; background-color:${brand.accentLight};">
          <table style="width:100%; font-family: Georgia, serif;">
            <tr>
              <td style="vertical-align:top; width:60%;">
                <p style="margin:0 0 2px; font-size:15px; color:${brand.foreground}; font-weight:bold;">Monthly Retainer</p>
                <span style="display:inline-block; background-color:${brand.accent}; color:${brand.white}; font-size:9px; font-weight:bold; letter-spacing:0.1em; text-transform:uppercase; padding:2px 8px; border-radius:10px; margin-bottom:8px;">Most Popular</span>
                <p style="margin:0; font-size:13px; color:${brand.foreground}; line-height:1.6;">Ongoing legal support with priority access, unlimited consultations, and dedicated case management.</p>
              </td>
              <td style="vertical-align:top; text-align:right; padding-left:16px;">
                <p style="margin:0; font-size:22px; color:${brand.primary}; font-weight:bold; font-family: Georgia, serif;">$1,500</p>
                <p style="margin:4px 0 0; font-size:11px; color:${brand.muted};">/month</p>
              </td>
            </tr>
          </table>
        </div>

        <!-- Option 3: Project-Based -->
        <div style="padding:20px 22px;">
          <table style="width:100%; font-family: Georgia, serif;">
            <tr>
              <td style="vertical-align:top; width:60%;">
                <p style="margin:0 0 4px; font-size:15px; color:${brand.foreground}; font-weight:bold;">Project-Based Engagement</p>
                <p style="margin:0 0 8px; font-size:12px; color:${brand.muted};">Custom quote after consultation</p>
                <p style="margin:0; font-size:13px; color:${brand.foreground}; line-height:1.6;">Scoped to your specific matter — ideal for one-time filings, document drafting, or research projects.</p>
              </td>
              <td style="vertical-align:top; text-align:right; padding-left:16px;">
                <p style="margin:0; font-size:22px; color:${brand.primary}; font-weight:bold; font-family: Georgia, serif;">Custom</p>
                <p style="margin:4px 0 0; font-size:11px; color:${brand.muted};">per project</p>
              </td>
            </tr>
          </table>
        </div>

      </div>
    </div>

    <!-- Retainer Benefits -->
    <div style="background-color:${brand.greenLight}; border:1px solid rgba(53,94,59,0.20); border-radius:10px; padding:22px 24px; margin:0 0 24px;">
      <p style="margin:0 0 12px; font-size:11px; font-weight:bold; letter-spacing:0.12em; text-transform:uppercase; color:${brand.green}; font-family: Georgia, serif;">What's Included in Your Retainer</p>
      <table style="width:100%; font-family: Georgia, serif;">
        <tr>
          <td style="padding:5px 0; font-size:13px; color:${brand.foreground}; line-height:1.6;">&#10003;&nbsp; Priority scheduling &amp; same-day response</td>
        </tr>
        <tr>
          <td style="padding:5px 0; font-size:13px; color:${brand.foreground}; line-height:1.6;">&#10003;&nbsp; Dedicated case portal with document storage</td>
        </tr>
        <tr>
          <td style="padding:5px 0; font-size:13px; color:${brand.foreground}; line-height:1.6;">&#10003;&nbsp; Monthly case status reports &amp; milestone updates</td>
        </tr>
        <tr>
          <td style="padding:5px 0; font-size:13px; color:${brand.foreground}; line-height:1.6;">&#10003;&nbsp; Unlimited document drafting &amp; review</td>
        </tr>
        <tr>
          <td style="padding:5px 0; font-size:13px; color:${brand.foreground}; line-height:1.6;">&#10003;&nbsp; Court filing coordination &amp; deadline tracking</td>
        </tr>
      </table>
    </div>

    ${ctaButton(`${SITE_URL}/availability`, "Set Up Your Retainer Now", brand.green)}

    ${bodyText(`Not ready to commit yet? No problem — we can discuss the best option during our consultation. I'll have a custom proposal ready for you.`)}

    ${signature()}
  `;

  return {
    subject: `Your Retainer Options — ${service} Case`,
    html: emailWrapper(content, `Review your engagement options before our consultation. Retainer details inside.`),
  };
}

/**
 * Step 3 — Day 3: Next-Step Reminders & Case Kickoff Guide
 * Sent 3 days after booking as a final pre-consultation checklist.
 */
function nextStepRemindersEmail(name: string, service: string, eventDate: string): { subject: string; html: string } {
  const firstName = name.split(" ")[0];

  const content = `
    ${badge("&#9989; Pre-Consultation Checklist")}
    ${sectionTitle(`You're almost ready, ${firstName}`)}
    ${bodyText(`Your consultation for <strong>${service}</strong> is coming up on <strong>${eventDate}</strong>. Here's a quick checklist to make sure you're fully prepared for a productive kickoff.`)}

    <!-- 5-Step Kickoff Progress -->
    <div style="background-color:${brand.bgCard}; border:1px solid ${brand.border}; border-radius:10px; overflow:hidden; margin:0 0 24px;">
      <div style="background-color:${brand.primary}; padding:12px 22px;">
        <p style="margin:0; font-size:11px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.12em; font-family: Georgia, serif;">&#128640; Case Kickoff — 5 Steps</p>
      </div>
      <div style="padding:20px 22px;">

        <!-- Step 1 -->
        <table style="width:100%; margin-bottom:14px; font-family: Georgia, serif;">
          <tr>
            <td style="width:36px; vertical-align:top; padding-top:2px;">
              <div style="width:28px; height:28px; border-radius:50%; background-color:${brand.green}; display:inline-flex; align-items:center; justify-content:center; text-align:center; line-height:28px;">
                <span style="color:${brand.white}; font-size:12px; font-weight:bold;">1</span>
              </div>
            </td>
            <td style="vertical-align:top; padding-left:12px;">
              <p style="margin:0 0 3px; font-size:14px; color:${brand.foreground}; font-weight:bold;">Gather Your Documents &#10003;</p>
              <p style="margin:0; font-size:12px; color:${brand.muted}; line-height:1.6;">Use the checklist from your first email. Upload to your portal or bring to the call.</p>
            </td>
          </tr>
        </table>

        <!-- Step 2 -->
        <table style="width:100%; margin-bottom:14px; font-family: Georgia, serif;">
          <tr>
            <td style="width:36px; vertical-align:top; padding-top:2px;">
              <div style="width:28px; height:28px; border-radius:50%; background-color:${brand.green}; display:inline-flex; align-items:center; justify-content:center; text-align:center; line-height:28px;">
                <span style="color:${brand.white}; font-size:12px; font-weight:bold;">2</span>
              </div>
            </td>
            <td style="vertical-align:top; padding-left:12px;">
              <p style="margin:0 0 3px; font-size:14px; color:${brand.foreground}; font-weight:bold;">Review Retainer Options</p>
              <p style="margin:0; font-size:12px; color:${brand.muted}; line-height:1.6;">Consider which engagement model fits your needs — deposit, retainer, or project-based.</p>
            </td>
          </tr>
        </table>

        <!-- Step 3 -->
        <table style="width:100%; margin-bottom:14px; font-family: Georgia, serif;">
          <tr>
            <td style="width:36px; vertical-align:top; padding-top:2px;">
              <div style="width:28px; height:28px; border-radius:50%; background-color:${brand.accent}; display:inline-flex; align-items:center; justify-content:center; text-align:center; line-height:28px;">
                <span style="color:${brand.white}; font-size:12px; font-weight:bold;">3</span>
              </div>
            </td>
            <td style="vertical-align:top; padding-left:12px;">
              <p style="margin:0 0 3px; font-size:14px; color:${brand.foreground}; font-weight:bold;">Write Down Your Top 3 Questions</p>
              <p style="margin:0; font-size:12px; color:${brand.muted}; line-height:1.6;">What do you most need clarity on? Prioritizing your questions ensures we cover what matters most.</p>
            </td>
          </tr>
        </table>

        <!-- Step 4 -->
        <table style="width:100%; margin-bottom:14px; font-family: Georgia, serif;">
          <tr>
            <td style="width:36px; vertical-align:top; padding-top:2px;">
              <div style="width:28px; height:28px; border-radius:50%; background-color:${brand.accent}; display:inline-flex; align-items:center; justify-content:center; text-align:center; line-height:28px;">
                <span style="color:${brand.white}; font-size:12px; font-weight:bold;">4</span>
              </div>
            </td>
            <td style="vertical-align:top; padding-left:12px;">
              <p style="margin:0 0 3px; font-size:14px; color:${brand.foreground}; font-weight:bold;">Confirm Your Meeting Link</p>
              <p style="margin:0; font-size:12px; color:${brand.muted}; line-height:1.6;">Check your Calendly confirmation email for the video call link or phone number.</p>
            </td>
          </tr>
        </table>

        <!-- Step 5 -->
        <table style="width:100%; font-family: Georgia, serif;">
          <tr>
            <td style="width:36px; vertical-align:top; padding-top:2px;">
              <div style="width:28px; height:28px; border-radius:50%; background-color:${brand.border}; display:inline-flex; align-items:center; justify-content:center; text-align:center; line-height:28px;">
                <span style="color:${brand.muted}; font-size:12px; font-weight:bold;">5</span>
              </div>
            </td>
            <td style="vertical-align:top; padding-left:12px;">
              <p style="margin:0 0 3px; font-size:14px; color:${brand.muted}; font-weight:bold;">Sign Engagement Agreement <span style="font-size:11px; font-weight:normal;">(After Consultation)</span></p>
              <p style="margin:0; font-size:12px; color:${brand.muted}; line-height:1.6;">I'll send a formal engagement letter within 24 hours of our call if we decide to move forward.</p>
            </td>
          </tr>
        </table>

      </div>
    </div>

    <!-- What to Expect -->
    <div style="background-color:${brand.accentLight}; border-left:3px solid ${brand.accent}; padding:18px 22px; border-radius:0 8px 8px 0; margin:0 0 24px;">
      <p style="margin:0 0 10px; font-size:12px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.1em; font-family: Georgia, serif;">What to Expect in Our Consultation</p>
      <p style="margin:0 0 8px; font-size:14px; color:${brand.foreground}; line-height:1.7; font-family: Georgia, serif;">
        &#8594;&nbsp; <strong>Case overview</strong> — I'll review your situation and identify key legal support needs
      </p>
      <p style="margin:0 0 8px; font-size:14px; color:${brand.foreground}; line-height:1.7; font-family: Georgia, serif;">
        &#8594;&nbsp; <strong>Service recommendations</strong> — tailored to your specific matter and timeline
      </p>
      <p style="margin:0 0 8px; font-size:14px; color:${brand.foreground}; line-height:1.7; font-family: Georgia, serif;">
        &#8594;&nbsp; <strong>Engagement proposal</strong> — pricing, scope, and next steps outlined clearly
      </p>
      <p style="margin:0; font-size:14px; color:${brand.foreground}; line-height:1.7; font-family: Georgia, serif;">
        &#8594;&nbsp; <strong>Q&amp;A</strong> — your questions answered, no pressure to commit on the call
      </p>
    </div>

    ${ctaButton(`${SITE_URL}/portal/cases`, "View My Case Portal")}

    ${bodyText(`I look forward to speaking with you on <strong>${eventDate}</strong>. If anything comes up before then, don't hesitate to reach out directly.`)}

    ${signature("See you soon")}
  `;

  return {
    subject: `Your Pre-Consultation Checklist — ${service} Consultation`,
    html: emailWrapper(content, `Your consultation is almost here. Here's your final pre-call checklist.`),
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
      eventDate,
    } = await req.json();

    const RESEND_API_KEY = (globalThis as any)?.Deno?.env?.get("RESEND_API_KEY");
    const SUPABASE_URL = (globalThis as any)?.Deno?.env?.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = (globalThis as any)?.Deno?.env?.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase credentials not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const displayDate = eventDate ?? "your upcoming consultation";

    let emailData: { subject: string; html: string };

    switch (stepNumber) {
      case 1:
        emailData = documentChecklistEmail(recipientName, service, displayDate);
        break;
      case 2:
        emailData = retainerConfirmationEmail(recipientName, service);
        break;
      case 3:
        emailData = nextStepRemindersEmail(recipientName, service, displayDate);
        break;
      default:
        throw new Error(`Unknown step number: ${stepNumber}`);
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

    // Update sequence record as sent
    if (sequenceId) {
      await supabase
        .from("email_sequences")
        .update({
          send_status: "sent",
          sent_at: new Date().toISOString(),
          resend_email_id: resendData.id ?? null,
        })
        .eq("id", sequenceId);
    }

    return new Response(
      JSON.stringify({ success: true, emailId: resendData.id, step: stepNumber }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error: any) {
    // Mark sequence as failed if we have a sequenceId
    try {
      const { sequenceId } = await (req.clone().json().catch(() => ({})));
      if (sequenceId) {
        const SUPABASE_URL = (globalThis as any)?.Deno?.env?.get("SUPABASE_URL");
        const SUPABASE_SERVICE_ROLE_KEY = (globalThis as any)?.Deno?.env?.get("SUPABASE_SERVICE_ROLE_KEY");
        if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
          const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
          await supabase
            .from("email_sequences")
            .update({ send_status: "failed", error_message: error.message })
            .eq("id", sequenceId);
        }
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
