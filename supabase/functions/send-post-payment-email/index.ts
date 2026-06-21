import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

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
    <body style="margin:0; padding:0; background-color:#EDE8E0; font-family: Georgia, 'Times New Roman', serif; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#EDE8E0; padding: 40px 16px;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px; width:100%; background-color:${brand.bg}; border-radius:14px; overflow:hidden; border: 1px solid ${brand.border}; box-shadow: 0 4px 24px rgba(74,55,40,0.10);">
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
            <tr>
              <td style="padding: 36px 36px 32px;">
                ${content}
              </td>
            </tr>
            <tr>
              <td style="background-color:${brand.secondary}; padding: 20px 36px; border-top: 1px solid ${brand.border};">
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                  <tr>
                    <td>
                      <p style="margin:0 0 6px; font-size:12px; color:${brand.primary}; font-weight:bold; font-family: Georgia, serif; letter-spacing:0.04em;">Maggi May Broussard Legal Services</p>
                      <p style="margin:0; font-size:11px; color:${brand.muted}; line-height:1.7;">
                        You received this because you have an active engagement with Maggi May Broussard Legal Services.
                        &nbsp;·&nbsp;
                        <a href="${SITE_URL}/portal/dashboard" style="color:${brand.accent}; text-decoration:none;">Access your portal</a>
                        &nbsp;·&nbsp;
                        <a href="mailto:maggimaybroussard@gmail.com" style="color:${brand.accent}; text-decoration:none;">Contact us</a>
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

// ─── Receipt Row Helper ───────────────────────────────────────────────────────

function receiptRow(label: string, value: string, isLast = false): string {
  return `
    <tr>
      <td style="padding:11px 0; ${isLast ? "" : `border-bottom:1px solid rgba(217,208,197,0.5);`} vertical-align:top; width:45%;">
        <p style="margin:0; font-size:12px; color:${brand.muted}; font-family: Georgia, serif; letter-spacing:0.04em; text-transform:uppercase;">${label}</p>
      </td>
      <td style="padding:11px 0 11px 16px; ${isLast ? "" : `border-bottom:1px solid rgba(217,208,197,0.5);`} vertical-align:top; text-align:right;">
        <p style="margin:0; font-size:14px; color:${brand.foreground}; font-family: Georgia, serif; font-weight:bold;">${value}</p>
      </td>
    </tr>
  `;
}

// ─── Email Templates ──────────────────────────────────────────────────────────

/**
 * Step 1 — Immediate: Payment Receipt + Consultation Date + Next Steps CTA
 */
function welcomeEmail(
  name: string,
  service: string,
  amount: number,
  paymentType: string,
  referenceCode: string,
  consultationDate?: string | null,
  paymentDate?: string | null
): { subject: string; html: string } {
  const firstName = name.split(" ")[0];
  const isRetainer = paymentType === "retainer_full" || paymentType === "retainer_partial";
  const isDeposit = paymentType === "consultation_deposit";

  const paymentLabel = isDeposit
    ? "Consultation Deposit"
    : isRetainer
    ? "Retainer Payment" :"Legal Services Payment";

  const formattedDate = paymentDate ?? new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const content = `
    ${badge("&#10003; Payment Confirmed", brand.green)}
    ${sectionTitle(`Your receipt is ready, ${firstName}`)}
    ${bodyText(`Thank you — your payment has been received and confirmed. Below is your official receipt. Please save this email for your records.`)}

    <!-- ── Receipt Card ── -->
    <div style="background-color:${brand.bgCard}; border:1px solid ${brand.border}; border-radius:12px; overflow:hidden; margin:0 0 28px;">
      <!-- Receipt header -->
      <div style="background: linear-gradient(135deg, ${brand.primary} 0%, #3A2A1E 100%); padding:18px 24px; display:flex; justify-content:space-between; align-items:center;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td>
              <p style="margin:0; font-size:11px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.14em; font-family: Georgia, serif;">Payment Receipt</p>
              <p style="margin:4px 0 0; font-size:18px; color:${brand.white}; font-family: Georgia, serif; font-weight:bold; letter-spacing:0.02em;">${referenceCode}</p>
            </td>
            <td style="text-align:right; vertical-align:top;">
              <span style="display:inline-block; background-color:rgba(53,94,59,0.85); color:#AEEAB4; font-size:10px; font-weight:bold; letter-spacing:0.12em; text-transform:uppercase; padding:5px 14px; border-radius:20px; font-family: Georgia, serif;">&#10003; Paid</span>
            </td>
          </tr>
        </table>
      </div>
      <!-- Receipt rows -->
      <div style="padding:6px 24px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          ${receiptRow("Billed To", name)}
          ${receiptRow("Service", service || paymentLabel)}
          ${receiptRow("Payment Type", paymentLabel)}
          ${receiptRow("Date", formattedDate)}
          <tr>
            <td style="padding:14px 0 6px; border-top:2px solid ${brand.accent}; vertical-align:top; width:45%;">
              <p style="margin:0; font-size:13px; color:${brand.foreground}; font-family: Georgia, serif; font-weight:bold; text-transform:uppercase; letter-spacing:0.06em;">Total Paid</p>
            </td>
            <td style="padding:14px 0 6px 16px; border-top:2px solid ${brand.accent}; vertical-align:top; text-align:right;">
              <p style="margin:0; font-size:22px; color:${brand.green}; font-family: Georgia, serif; font-weight:bold;">$${amount.toLocaleString()} <span style="font-size:13px; color:${brand.muted};">USD</span></p>
            </td>
          </tr>
        </table>
      </div>
      <!-- Secure note -->
      <div style="background-color:${brand.secondary}; padding:12px 24px; border-top:1px solid ${brand.border};">
        <p style="margin:0; font-size:11px; color:${brand.muted}; font-family: Georgia, serif; line-height:1.6;">
          &#128274;&nbsp; Payment processed securely via Stripe. Your card details are never stored on our servers.
        </p>
      </div>
    </div>

    <!-- ── Consultation Date / Scheduling ── -->
    ${
      consultationDate
        ? `
    <div style="background-color:${brand.accentLight}; border:1px solid rgba(200,150,90,0.35); border-radius:10px; padding:22px 24px; margin:0 0 28px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td style="vertical-align:middle; width:44px;">
            <div style="width:40px; height:40px; border-radius:10px; background-color:${brand.accent}; text-align:center; line-height:40px; font-size:20px;">&#128197;</div>
          </td>
          <td style="padding-left:16px; vertical-align:middle;">
            <p style="margin:0 0 3px; font-size:11px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.12em; font-family: Georgia, serif;">Your Consultation</p>
            <p style="margin:0; font-size:17px; color:${brand.foreground}; font-family: Georgia, serif; font-weight:bold;">${consultationDate}</p>
          </td>
        </tr>
      </table>
      <p style="margin:14px 0 0; font-size:13px; color:${brand.foreground}; line-height:1.7; font-family: Georgia, serif;">
        A calendar invite has been sent to your email. If you need to reschedule, please do so at least 24 hours in advance.
      </p>
    </div>
    `
        : `
    <div style="background-color:${brand.accentLight}; border:1px solid rgba(200,150,90,0.35); border-radius:10px; padding:22px 24px; margin:0 0 28px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td style="vertical-align:middle; width:44px;">
            <div style="width:40px; height:40px; border-radius:10px; background-color:${brand.accent}; text-align:center; line-height:40px; font-size:20px;">&#128197;</div>
          </td>
          <td style="padding-left:16px; vertical-align:middle;">
            <p style="margin:0 0 3px; font-size:11px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.12em; font-family: Georgia, serif;">${isDeposit ? "Schedule Your Consultation" : "Book Your Onboarding Call"}</p>
            <p style="margin:0; font-size:15px; color:${brand.foreground}; font-family: Georgia, serif; line-height:1.5;">${isDeposit ? "Your deposit is confirmed — now let's find a time that works for you." : "Your retainer is active — book your onboarding call to get started."}</p>
          </td>
        </tr>
      </table>
      ${ctaButton(`${SITE_URL}/availability`, isDeposit ? "Schedule My Consultation &rarr;" : "Book My Onboarding Call &rarr;", brand.accent)}
    </div>
    `
    }

    <!-- ── Next Steps ── -->
    <div style="background-color:${brand.bgCard}; border:1px solid ${brand.border}; border-radius:10px; overflow:hidden; margin:0 0 28px;">
      <div style="background-color:${brand.primary}; padding:12px 22px;">
        <p style="margin:0; font-size:11px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.12em; font-family: Georgia, serif;">&#128203; What Happens Next</p>
      </div>
      <div style="padding:20px 22px;">
        <table style="width:100%; border-collapse:collapse; font-family: Georgia, serif;">
          <tr>
            <td style="padding:12px 0; border-bottom:1px solid rgba(217,208,197,0.5); vertical-align:top; width:36px;">
              <div style="width:28px; height:28px; border-radius:50%; background-color:${brand.accent}; text-align:center; line-height:28px; font-size:12px; font-weight:bold; color:${brand.white}; font-family: Georgia, serif;">1</div>
            </td>
            <td style="padding:12px 0 12px 14px; border-bottom:1px solid rgba(217,208,197,0.5); vertical-align:top;">
              <p style="margin:0 0 3px; font-size:14px; color:${brand.foreground}; font-weight:bold;">Check Your Email</p>
              <p style="margin:0; font-size:12px; color:${brand.muted};">Within 24 hours you'll receive a tailored document checklist for your <strong>${service || "legal"}</strong> matter.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 0; border-bottom:1px solid rgba(217,208,197,0.5); vertical-align:top;">
              <div style="width:28px; height:28px; border-radius:50%; background-color:${brand.accent}; text-align:center; line-height:28px; font-size:12px; font-weight:bold; color:${brand.white}; font-family: Georgia, serif;">2</div>
            </td>
            <td style="padding:12px 0 12px 14px; border-bottom:1px solid rgba(217,208,197,0.5); vertical-align:top;">
              <p style="margin:0 0 3px; font-size:14px; color:${brand.foreground}; font-weight:bold;">Upload Your Documents</p>
              <p style="margin:0; font-size:12px; color:${brand.muted};">Log in to your secure client portal and upload any relevant documents so I can review them before our call.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 0; border-bottom:1px solid rgba(217,208,197,0.5); vertical-align:top;">
              <div style="width:28px; height:28px; border-radius:50%; background-color:${brand.accent}; text-align:center; line-height:28px; font-size:12px; font-weight:bold; color:${brand.white}; font-family: Georgia, serif;">3</div>
            </td>
            <td style="padding:12px 0 12px 14px; border-bottom:1px solid rgba(217,208,197,0.5); vertical-align:top;">
              <p style="margin:0 0 3px; font-size:14px; color:${brand.foreground}; font-weight:bold;">${consultationDate ? "Attend Your Consultation" : (isDeposit ? "Schedule Your Consultation" : "Book Your Onboarding Call")}</p>
              <p style="margin:0; font-size:12px; color:${brand.muted};">${consultationDate ? `Your consultation is confirmed for ${consultationDate}. I'll have reviewed your documents and be fully prepared.` : "Use the scheduling link to pick a time that works for you. I'll be fully prepared with your documents reviewed."}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 0; vertical-align:top;">
              <div style="width:28px; height:28px; border-radius:50%; background-color:${brand.green}; text-align:center; line-height:28px; font-size:12px; font-weight:bold; color:${brand.white}; font-family: Georgia, serif;">4</div>
            </td>
            <td style="padding:12px 0 12px 14px; vertical-align:top;">
              <p style="margin:0 0 3px; font-size:14px; color:${brand.foreground}; font-weight:bold;">We Get to Work</p>
              <p style="margin:0; font-size:12px; color:${brand.muted};">${isRetainer ? "Once your retainer is active and documents are reviewed, I'll begin work on your matter immediately." : "After our consultation, I'll provide a clear action plan and next steps tailored to your case."}</p>
            </td>
          </tr>
        </table>
      </div>
    </div>

    <!-- ── Portal CTA ── -->
    <div style="background-color:${brand.greenLight}; border-left:3px solid ${brand.green}; padding:18px 22px; border-radius:0 8px 8px 0; margin:0 0 8px;">
      <p style="margin:0 0 6px; font-size:12px; color:${brand.green}; font-weight:bold; text-transform:uppercase; letter-spacing:0.1em; font-family: Georgia, serif;">&#128274; Your Secure Client Portal</p>
      <p style="margin:0; font-size:14px; color:${brand.foreground}; line-height:1.7; font-family: Georgia, serif;">
        Access your invoices, upload documents, and track your case progress — all in one place.
      </p>
    </div>

    ${ctaButton(`${SITE_URL}/portal/dashboard`, "Access My Client Portal", brand.green)}

    ${bodyText(`Questions? Reply to this email or reach out directly — I typically respond within one business day.`)}

    ${signature("Welcome aboard")}
  `;

  return {
    subject: `Receipt confirmed: ${referenceCode} — here's what happens next`,
    html: emailWrapper(
      content,
      `Your $${amount.toLocaleString()} payment is confirmed. Receipt ${referenceCode} enclosed — plus your next steps.`
    ),
  };
}

/**
 * Step 2 — Day 1: Documentation Request
 */
function documentationRequestEmail(
  name: string,
  service: string
): { subject: string; html: string } {
  const firstName = name.split(" ")[0];

  const content = `
    ${badge("&#128196; Action Required — Documents Needed")}
    ${sectionTitle(`Let's gather your documents, ${firstName}`)}
    ${bodyText(`To provide you with the best possible support on your <strong>${service}</strong> matter, I need to review some key documents before we dive in.`)}
    ${bodyText(`Uploading these early gives me time to review everything thoroughly so our first call is focused and productive — not spent gathering basics.`)}

    <!-- Document Checklist -->
    <div style="background-color:${brand.bgCard}; border:1px solid ${brand.border}; border-radius:10px; overflow:hidden; margin:0 0 24px;">
      <div style="background-color:${brand.primary}; padding:12px 22px;">
        <p style="margin:0; font-size:11px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.12em; font-family: Georgia, serif;">&#128203; Documents to Upload</p>
      </div>
      <div style="padding:20px 22px;">
        <table style="width:100%; border-collapse:collapse; font-family: Georgia, serif;">
          ${[
            ["Government-Issued ID", "Driver's license, passport, or state ID"],
            ["Relevant Contracts or Agreements", "Any signed documents related to your matter"],
            ["Correspondence & Communications", "Emails, letters, or notices from opposing parties or courts"],
            ["Court Filings or Case Numbers", "If your matter involves existing litigation"],
            ["Financial Records (if applicable)", "Bank statements, invoices, or payment records"],
            ["Timeline of Key Events", "A brief written summary of dates and what happened"],
          ]
            .map(
              ([title, desc], i, arr) => `
            <tr>
              <td style="padding:10px 0; ${i < arr.length - 1 ? `border-bottom:1px solid rgba(217,208,197,0.5);` : ""} vertical-align:top;">
                <p style="margin:0 0 3px; font-size:14px; color:${brand.foreground}; font-weight:bold;">&#9744;&nbsp; ${title}</p>
                <p style="margin:0; font-size:12px; color:${brand.muted};">${desc}</p>
              </td>
            </tr>`
            )
            .join("")}
        </table>
      </div>
    </div>

    <!-- Upload Info -->
    <div style="background-color:${brand.greenLight}; border-left:3px solid ${brand.green}; padding:18px 22px; border-radius:0 8px 8px 0; margin:0 0 24px;">
      <p style="margin:0 0 8px; font-size:12px; color:${brand.green}; font-weight:bold; text-transform:uppercase; letter-spacing:0.1em; font-family: Georgia, serif;">&#128274; Secure Upload</p>
      <p style="margin:0 0 8px; font-size:14px; color:${brand.foreground}; line-height:1.7; font-family: Georgia, serif;">
        All documents are encrypted and stored securely. Only you and my team can access your files.
      </p>
      <p style="margin:0; font-size:12px; color:${brand.muted}; font-family: Georgia, serif;">
        Accepted formats: PDF, Word (.docx), Excel (.xlsx), JPEG, PNG — max 10MB per file
      </p>
    </div>

    ${ctaButton(`${SITE_URL}/portal/cases`, "Upload My Documents Now")}

    ${bodyText(`Don't have everything ready? That's okay — upload what you have and we can discuss the rest during our call. Even partial documentation helps me prepare.`)}

    ${bodyText(`If you're unsure whether a document is relevant, include it anyway. It's always better to have more context than less.`)}

    ${signature()}
  `;

  return {
    subject: `Action needed: Please upload your documents for your ${service} matter`,
    html: emailWrapper(content, `I need a few documents from you to get started on your matter.`),
  };
}

/**
 * Step 3 — Day 3: Engagement Expectations
 */
function engagementExpectationsEmail(
  name: string,
  service: string,
  paymentType: string
): { subject: string; html: string } {
  const firstName = name.split(" ")[0];
  const isRetainer = paymentType === "retainer_full" || paymentType === "retainer_partial";

  const content = `
    ${badge("&#128203; How We Work Together")}
    ${sectionTitle(`Setting expectations, ${firstName}`)}
    ${bodyText(`I want to make sure our working relationship is as smooth and productive as possible. Here's everything you need to know about how I work and what you can expect from me throughout your <strong>${service}</strong> engagement.`)}

    <!-- Communication Standards -->
    <div style="background-color:${brand.bgCard}; border:1px solid ${brand.border}; border-radius:10px; overflow:hidden; margin:0 0 24px;">
      <div style="background-color:${brand.primary}; padding:12px 22px;">
        <p style="margin:0; font-size:11px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.12em; font-family: Georgia, serif;">&#128172; Communication &amp; Response Times</p>
      </div>
      <div style="padding:20px 22px;">
        <table style="width:100%; border-collapse:collapse; font-family: Georgia, serif;">
          <tr>
            <td style="padding:10px 0; border-bottom:1px solid rgba(217,208,197,0.5); vertical-align:top;">
              <p style="margin:0 0 3px; font-size:14px; color:${brand.foreground}; font-weight:bold;">&#9200;&nbsp; Response Time</p>
              <p style="margin:0; font-size:12px; color:${brand.muted};">I respond to all emails and messages within <strong>1 business day</strong> (Monday–Friday, 9am–5pm CST).</p>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0; border-bottom:1px solid rgba(217,208,197,0.5); vertical-align:top;">
              <p style="margin:0 0 3px; font-size:14px; color:${brand.foreground}; font-weight:bold;">&#128222;&nbsp; Preferred Contact Method</p>
              <p style="margin:0; font-size:12px; color:${brand.muted};">Email is the best way to reach me. For urgent matters, note "URGENT" in the subject line.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0; border-bottom:1px solid rgba(217,208,197,0.5); vertical-align:top;">
              <p style="margin:0 0 3px; font-size:14px; color:${brand.foreground}; font-weight:bold;">&#128203;&nbsp; Progress Updates</p>
              <p style="margin:0; font-size:12px; color:${brand.muted};">I'll send you regular updates on your matter. You can also check your client portal at any time for the latest status.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0; vertical-align:top;">
              <p style="margin:0 0 3px; font-size:14px; color:${brand.foreground}; font-weight:bold;">&#128274;&nbsp; Confidentiality</p>
              <p style="margin:0; font-size:12px; color:${brand.muted};">Everything you share with me is strictly confidential. Your documents and case details are never shared with third parties.</p>
            </td>
          </tr>
        </table>
      </div>
    </div>

    <!-- What I Need From You -->
    <div style="background-color:${brand.bgCard}; border:1px solid ${brand.border}; border-radius:10px; overflow:hidden; margin:0 0 24px;">
      <div style="background-color:${brand.primary}; padding:12px 22px;">
        <p style="margin:0; font-size:11px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.12em; font-family: Georgia, serif;">&#9989;&nbsp; What I Need From You</p>
      </div>
      <div style="padding:20px 22px;">
        <table style="width:100%; border-collapse:collapse; font-family: Georgia, serif;">
          ${[
            ["Timely Document Sharing", "The faster you share documents, the faster I can move on your matter. Delays in document delivery may affect timelines."],
            ["Clear Communication", "If your situation changes or you have new information, let me know right away. Early communication prevents complications."],
            ["Honest & Complete Information", "I can only help you effectively if I have the full picture. Please share all relevant details, even if they seem unfavorable."],
            ["Reasonable Timelines", "Quality legal support takes time. I'll always give you realistic timelines and meet them — please allow adequate time for thorough work."],
          ]
            .map(
              ([title, desc], i, arr) => `
            <tr>
              <td style="padding:10px 0; ${i < arr.length - 1 ? `border-bottom:1px solid rgba(217,208,197,0.5);` : ""} vertical-align:top;">
                <p style="margin:0 0 3px; font-size:14px; color:${brand.foreground}; font-weight:bold;">&#10003;&nbsp; ${title}</p>
                <p style="margin:0; font-size:12px; color:${brand.muted};">${desc}</p>
              </td>
            </tr>`
            )
            .join("")}
        </table>
      </div>
    </div>

    ${
      isRetainer
        ? `
    <!-- Retainer Scope -->
    <div style="background-color:${brand.accentLight}; border-left:3px solid ${brand.accent}; padding:18px 22px; border-radius:0 8px 8px 0; margin:0 0 24px;">
      <p style="margin:0 0 8px; font-size:12px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.1em; font-family: Georgia, serif;">&#128179; Your Retainer</p>
      <p style="margin:0 0 8px; font-size:14px; color:${brand.foreground}; line-height:1.7; font-family: Georgia, serif;">
        Your retainer covers the scope of work we discussed. If additional work is needed beyond that scope, I'll always notify you in advance before proceeding.
      </p>
      <p style="margin:0; font-size:12px; color:${brand.muted}; font-family: Georgia, serif;">
        Detailed scope and deliverables will be outlined in your engagement letter, which I'll send shortly.
      </p>
    </div>
    `
        : ""
    }

    <!-- Important Note -->
    <div style="background-color:${brand.greenLight}; border-left:3px solid ${brand.green}; padding:18px 22px; border-radius:0 8px 8px 0; margin:0 0 24px;">
      <p style="margin:0 0 8px; font-size:12px; color:${brand.green}; font-weight:bold; text-transform:uppercase; letter-spacing:0.1em; font-family: Georgia, serif;">&#9888;&#65039; Important Note</p>
      <p style="margin:0; font-size:14px; color:${brand.foreground}; line-height:1.7; font-family: Georgia, serif;">
        I am a licensed paralegal, not an attorney. I provide paralegal support services and cannot provide legal advice, represent you in court, or establish an attorney-client relationship. For legal advice, please consult a licensed attorney.
      </p>
    </div>

    ${ctaButton(`${SITE_URL}/portal/dashboard`, "View My Client Portal")}

    ${bodyText(`I'm looking forward to working with you, ${firstName}. If you have any questions about any of the above, please don't hesitate to reach out.`)}

    ${signature("Looking forward to working with you")}
  `;

  return {
    subject: `How we work together — your ${service} engagement guide`,
    html: emailWrapper(content, `Everything you need to know about working with me on your matter.`),
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
      stepNumber,
      recipientEmail,
      recipientName,
      service,
      amount,
      paymentType,
      referenceCode,
      consultationDate,
      paymentDate,
    } = await req.json();

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase credentials not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Build email based on step
    let emailData: { subject: string; html: string };

    if (stepNumber === 1) {
      emailData = welcomeEmail(
        recipientName ?? "Valued Client",
        service ?? "Legal Services",
        amount ?? 0,
        paymentType ?? "consultation_deposit",
        referenceCode ?? "N/A",
        consultationDate ?? null,
        paymentDate ?? null
      );
    } else if (stepNumber === 2) {
      emailData = documentationRequestEmail(
        recipientName ?? "Valued Client",
        service ?? "Legal Services"
      );
    } else if (stepNumber === 3) {
      emailData = engagementExpectationsEmail(
        recipientName ?? "Valued Client",
        service ?? "Legal Services",
        paymentType ?? "consultation_deposit"
      );
    } else {
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

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      throw new Error(resendData.message ?? "Resend API error");
    }

    // Update sequence record if sequenceId provided
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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
