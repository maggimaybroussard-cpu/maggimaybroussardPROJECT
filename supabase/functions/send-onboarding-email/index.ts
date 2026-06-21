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

function emailHeader(): string {
  return `
    <tr>
      <td style="background-color:${brand.primary};padding:0;">
        <div style="height:4px;background:linear-gradient(to right,${brand.accent},#E8B87A,${brand.accent});"></div>
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="padding:28px 36px 24px;">
          <tr><td>
            <table cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="border-right:2px solid ${brand.accent};padding-right:14px;vertical-align:middle;">
                  <p style="margin:0;font-size:10px;color:${brand.accent};letter-spacing:0.18em;text-transform:uppercase;font-family:Georgia,serif;line-height:1.4;">Paralegal</p>
                  <p style="margin:0;font-size:10px;color:${brand.accent};letter-spacing:0.18em;text-transform:uppercase;font-family:Georgia,serif;line-height:1.4;">Services</p>
                </td>
                <td style="padding-left:14px;vertical-align:middle;">
                  <h1 style="margin:0;font-size:24px;color:${brand.white};font-family:Georgia,'Times New Roman',serif;font-weight:normal;letter-spacing:0.01em;line-height:1.2;">Broussard Legal Services</h1>
                  <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.65);font-family:Georgia,serif;letter-spacing:0.06em;">Louisiana &amp; Nationwide</p>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>
        <div style="height:1px;background:linear-gradient(to right,${brand.accent},rgba(200,150,90,0.2),transparent);margin:0 36px;"></div>
        <div style="height:20px;"></div>
      </td>
    </tr>`;
}

function emailFooter(footerNote?: string): string {
  return `
    <tr>
      <td style="background-color:${brand.secondary};padding:20px 36px;border-top:1px solid ${brand.border};">
        <p style="margin:0 0 6px;font-size:12px;color:${brand.primary};font-weight:bold;font-family:Georgia,serif;letter-spacing:0.04em;">Broussard Legal Services</p>
        <p style="margin:0;font-size:11px;color:${brand.muted};line-height:1.7;">
          ${footerNote ?? "You are receiving this email as part of your consultation onboarding. If you have questions, reply to this message."}
        </p>
      </td>
    </tr>`;
}

function wrapEmail(previewText: string, bodyRows: string, footerNote?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <div style="display:none;font-size:1px;color:#fefefe;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${previewText}</div>
</head>
<body style="margin:0;padding:0;background-color:#EDE8E0;font-family:Georgia,'Times New Roman',serif;-webkit-text-size-adjust:100%;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#EDE8E0;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background-color:${brand.bg};border-radius:14px;overflow:hidden;border:1px solid ${brand.border};box-shadow:0 4px 24px rgba(74,55,40,0.10);">
        ${emailHeader()}
        ${bodyRows}
        ${emailFooter(footerNote)}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── 1. Payment Confirmation ────────────────────────────────────────────────
function buildPaymentConfirmationEmail(params: {
  firstName: string;
  service: string;
  amount: string;
  paymentDate: string;
  invoiceId?: string;
  bookingDate?: string;
  bookingTime?: string;
  meetingLocation?: string;
}): { subject: string; html: string } {
  const { firstName, service, amount, paymentDate, invoiceId, bookingDate, bookingTime, meetingLocation } = params;
  const subject = `Payment Confirmed — Your Consultation is Secured`;
  const portalLink = `${SITE_URL}/portal/billing`;

  const bodyRows = `
    <tr>
      <td style="padding:32px 36px 0;">
        <span style="display:inline-block;background-color:${brand.green};color:${brand.white};font-size:10px;font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;padding:4px 14px;border-radius:20px;margin-bottom:22px;font-family:Georgia,serif;">&#10003;&nbsp; Payment Confirmed</span>
        <h2 style="margin:0 0 20px;font-size:21px;color:${brand.foreground};font-family:Georgia,'Times New Roman',serif;font-weight:normal;letter-spacing:-0.01em;border-bottom:1px solid ${brand.border};padding-bottom:14px;">Your payment has been received</h2>
      </td>
    </tr>
    <tr>
      <td style="padding:0 36px 32px;">
        <p style="margin:0 0 16px;font-size:15px;color:${brand.foreground};line-height:1.8;font-family:Georgia,serif;">Dear ${firstName},</p>
        <p style="margin:0 0 20px;font-size:15px;color:${brand.foreground};line-height:1.8;font-family:Georgia,serif;">
          Thank you — your payment has been successfully processed. Your consultation slot is now fully secured and I look forward to speaking with you.
        </p>

        <!-- Payment Receipt Card -->
        <div style="background-color:${brand.bgCard};border:1px solid ${brand.border};border-radius:10px;overflow:hidden;margin:0 0 24px;">
          <div style="background-color:${brand.green};padding:12px 22px;">
            <p style="margin:0;font-size:11px;color:${brand.white};font-weight:bold;text-transform:uppercase;letter-spacing:0.12em;font-family:Georgia,serif;">&#128179;&nbsp; Payment Receipt</p>
          </div>
          <div style="padding:20px 22px;">
            <table style="width:100%;border-collapse:collapse;font-family:Georgia,serif;">
              <tr>
                <td style="padding:8px 0;color:${brand.muted};font-size:13px;width:45%;border-bottom:1px solid rgba(217,208,197,0.5);">Service</td>
                <td style="padding:8px 0;color:${brand.foreground};font-size:14px;font-weight:bold;border-bottom:1px solid rgba(217,208,197,0.5);">${service}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:${brand.muted};font-size:13px;border-bottom:1px solid rgba(217,208,197,0.5);">Amount Paid</td>
                <td style="padding:8px 0;color:${brand.green};font-size:16px;font-weight:bold;border-bottom:1px solid rgba(217,208,197,0.5);">${amount}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:${brand.muted};font-size:13px;border-bottom:1px solid rgba(217,208,197,0.5);">Payment Date</td>
                <td style="padding:8px 0;color:${brand.foreground};font-size:14px;font-weight:bold;border-bottom:1px solid rgba(217,208,197,0.5);">${paymentDate}</td>
              </tr>
              ${invoiceId ? `<tr>
                <td style="padding:8px 0;color:${brand.muted};font-size:13px;border-bottom:1px solid rgba(217,208,197,0.5);">Invoice #</td>
                <td style="padding:8px 0;color:${brand.foreground};font-size:14px;border-bottom:1px solid rgba(217,208,197,0.5);">${invoiceId}</td>
              </tr>` : ""}
              ${bookingDate ? `<tr>
                <td style="padding:8px 0;color:${brand.muted};font-size:13px;border-bottom:1px solid rgba(217,208,197,0.5);">Consultation Date</td>
                <td style="padding:8px 0;color:${brand.foreground};font-size:14px;font-weight:bold;border-bottom:1px solid rgba(217,208,197,0.5);">${bookingDate}</td>
              </tr>` : ""}
              ${bookingTime ? `<tr>
                <td style="padding:8px 0;color:${brand.muted};font-size:13px;border-bottom:1px solid rgba(217,208,197,0.5);">Time</td>
                <td style="padding:8px 0;color:${brand.foreground};font-size:14px;font-weight:bold;border-bottom:1px solid rgba(217,208,197,0.5);">${bookingTime}</td>
              </tr>` : ""}
              ${meetingLocation ? `<tr>
                <td style="padding:8px 0;color:${brand.muted};font-size:13px;">Meeting</td>
                <td style="padding:8px 0;color:${brand.foreground};font-size:14px;">${meetingLocation}</td>
              </tr>` : ""}
            </table>
          </div>
        </div>

        <!-- What's Next -->
        <div style="background-color:${brand.accentLight};border:1px solid rgba(200,150,90,0.3);border-radius:10px;padding:20px 24px;margin:0 0 28px;">
          <p style="margin:0 0 12px;font-size:12px;font-weight:bold;color:${brand.primary};font-family:Georgia,serif;letter-spacing:0.06em;text-transform:uppercase;">What happens next</p>
          ${[
            "You will receive a pre-consultation checklist to help you prepare",
            "Prep documents and resources will be sent 24 hours before your appointment",
            "A calendar reminder will be sent the day before your consultation",
          ].map(item => `
          <p style="margin:0 0 8px;font-size:14px;color:${brand.foreground};line-height:1.7;font-family:Georgia,serif;">
            <span style="color:${brand.accent};margin-right:8px;">&#8594;</span>${item}
          </p>`).join("")}
        </div>

        <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 28px;">
          <tr>
            <td style="background-color:${brand.accent};border-radius:8px;box-shadow:0 3px 12px rgba(200,150,90,0.35);">
              <a href="${portalLink}" style="display:inline-block;padding:14px 36px;color:${brand.white};text-decoration:none;font-size:14px;font-family:Georgia,serif;letter-spacing:0.05em;font-weight:bold;">View Billing &amp; Receipts &rarr;</a>
            </td>
          </tr>
        </table>

        <table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:28px;border-top:1px solid ${brand.border};padding-top:20px;width:100%;">
          <tr><td>
            <p style="margin:0 0 4px;font-size:15px;color:${brand.foreground};font-family:Georgia,serif;">Warm regards,</p>
            <p style="margin:0 0 2px;font-size:16px;color:${brand.primary};font-weight:bold;font-family:Georgia,serif;">Broussard Legal Services</p>
            <p style="margin:0 0 6px;font-size:12px;color:${brand.muted};font-family:Georgia,serif;letter-spacing:0.04em;">Licensed Paralegal &middot; Louisiana &amp; Nationwide</p>
            <a href="mailto:maggimaybroussard@gmail.com" style="color:${brand.accent};font-size:13px;text-decoration:none;font-family:Georgia,serif;">maggimaybroussard@gmail.com</a>
          </td></tr>
        </table>
      </td>
    </tr>`;

  return { subject, html: wrapEmail("Your consultation payment is confirmed — here's your receipt.", bodyRows, "You are receiving this email because a payment was processed for your consultation booking.") };
}

// ── 2. Prep Document Links ─────────────────────────────────────────────────
function buildPrepDocumentsEmail(params: {
  firstName: string;
  service: string;
  bookingDate?: string;
  bookingTime?: string;
  meetingLocation?: string;
  prepLink?: string;
  documents?: Array<{ name: string; url: string; description?: string }>;
}): { subject: string; html: string } {
  const { firstName, service, bookingDate, bookingTime, meetingLocation, prepLink, documents } = params;
  const subject = `Your Consultation Prep Materials — ${service}`;
  const defaultPrepLink = prepLink ?? `${SITE_URL}/portal/documents`;

  const docRows = documents && documents.length > 0
    ? documents.map(doc => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid rgba(217,208,197,0.4);">
          <table cellpadding="0" cellspacing="0" role="presentation" width="100%">
            <tr>
              <td style="vertical-align:top;padding-right:12px;">
                <div style="width:36px;height:36px;background-color:${brand.accentLight};border-radius:8px;display:flex;align-items:center;justify-content:center;text-align:center;line-height:36px;font-size:16px;">&#128196;</div>
              </td>
              <td style="vertical-align:middle;">
                <a href="${doc.url}" style="color:${brand.accent};font-size:14px;font-weight:bold;text-decoration:none;font-family:Georgia,serif;">${doc.name} &rarr;</a>
                ${doc.description ? `<p style="margin:3px 0 0;font-size:12px;color:${brand.muted};font-family:Georgia,serif;">${doc.description}</p>` : ""}
              </td>
            </tr>
          </table>
        </td>
      </tr>`).join("")
    : `<tr><td style="padding:16px 0;font-size:14px;color:${brand.muted};font-family:Georgia,serif;">Your prep documents will be available in your client portal.</td></tr>`;

  const bodyRows = `
    <tr>
      <td style="padding:32px 36px 0;">
        <span style="display:inline-block;background-color:${brand.accent};color:${brand.white};font-size:10px;font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;padding:4px 14px;border-radius:20px;margin-bottom:22px;font-family:Georgia,serif;">&#128196;&nbsp; Prep Materials Ready</span>
        <h2 style="margin:0 0 20px;font-size:21px;color:${brand.foreground};font-family:Georgia,'Times New Roman',serif;font-weight:normal;letter-spacing:-0.01em;border-bottom:1px solid ${brand.border};padding-bottom:14px;">Your consultation prep documents are ready</h2>
      </td>
    </tr>
    <tr>
      <td style="padding:0 36px 32px;">
        <p style="margin:0 0 16px;font-size:15px;color:${brand.foreground};line-height:1.8;font-family:Georgia,serif;">Dear ${firstName},</p>
        <p style="margin:0 0 20px;font-size:15px;color:${brand.foreground};line-height:1.8;font-family:Georgia,serif;">
          Your consultation for <strong>${service}</strong> is coming up${bookingDate ? ` on <strong>${bookingDate}</strong>${bookingTime ? ` at <strong>${bookingTime}</strong>` : ""}` : " soon"}. I have prepared the following resources to help you get the most out of our time together.
        </p>

        ${meetingLocation ? `
        <div style="background-color:${brand.greenLight};border:1px solid rgba(53,94,59,0.2);border-radius:8px;padding:14px 18px;margin:0 0 20px;">
          <p style="margin:0;font-size:13px;color:${brand.green};font-family:Georgia,serif;"><strong>Meeting Link:</strong> <a href="${meetingLocation}" style="color:${brand.green};">${meetingLocation}</a></p>
        </div>` : ""}

        <!-- Documents -->
        <div style="background-color:${brand.bgCard};border:1px solid ${brand.border};border-radius:10px;overflow:hidden;margin:0 0 24px;">
          <div style="background-color:${brand.primary};padding:12px 22px;">
            <p style="margin:0;font-size:11px;color:${brand.accent};font-weight:bold;text-transform:uppercase;letter-spacing:0.12em;font-family:Georgia,serif;">&#128196;&nbsp; Prep Documents &amp; Resources</p>
          </div>
          <div style="padding:8px 22px;">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              ${docRows}
            </table>
          </div>
        </div>

        <!-- Tips -->
        <div style="background-color:${brand.accentLight};border-left:3px solid ${brand.accent};padding:18px 22px;border-radius:0 8px 8px 0;margin:0 0 24px;">
          <p style="margin:0 0 10px;font-size:12px;color:${brand.accent};font-weight:bold;text-transform:uppercase;letter-spacing:0.1em;font-family:Georgia,serif;">Before our consultation</p>
          ${[
            "Review all attached documents thoroughly",
            "Note any questions or concerns you'd like to address",
            "Have relevant contracts, correspondence, or records ready to reference",
          ].map(tip => `<p style="margin:0 0 6px;font-size:14px;color:${brand.foreground};line-height:1.7;font-family:Georgia,serif;"><span style="color:${brand.accent};margin-right:8px;">&#8594;</span>${tip}</p>`).join("")}
        </div>

        <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 28px;">
          <tr>
            <td style="background-color:${brand.accent};border-radius:8px;box-shadow:0 3px 12px rgba(200,150,90,0.35);">
              <a href="${defaultPrepLink}" style="display:inline-block;padding:14px 36px;color:${brand.white};text-decoration:none;font-size:14px;font-family:Georgia,serif;letter-spacing:0.05em;font-weight:bold;">Access All Prep Materials &rarr;</a>
            </td>
          </tr>
        </table>

        <table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:28px;border-top:1px solid ${brand.border};padding-top:20px;width:100%;">
          <tr><td>
            <p style="margin:0 0 4px;font-size:15px;color:${brand.foreground};font-family:Georgia,serif;">See you soon,</p>
            <p style="margin:0 0 2px;font-size:16px;color:${brand.primary};font-weight:bold;font-family:Georgia,serif;">Broussard Legal Services</p>
            <p style="margin:0 0 6px;font-size:12px;color:${brand.muted};font-family:Georgia,serif;letter-spacing:0.04em;">Licensed Paralegal &middot; Louisiana &amp; Nationwide</p>
            <a href="mailto:maggimaybroussard@gmail.com" style="color:${brand.accent};font-size:13px;text-decoration:none;font-family:Georgia,serif;">maggimaybroussard@gmail.com</a>
          </td></tr>
        </table>
      </td>
    </tr>`;

  return { subject, html: wrapEmail(`Your prep materials for the ${service} consultation are ready.`, bodyRows) };
}

// ── 3. Pre-Consultation Checklist ──────────────────────────────────────────
function buildPreConsultationChecklistEmail(params: {
  firstName: string;
  service: string;
  bookingDate?: string;
  bookingTime?: string;
  meetingLocation?: string;
}): { subject: string; html: string } {
  const { firstName, service, bookingDate, bookingTime, meetingLocation } = params;
  const subject = `Pre-Consultation Checklist — Get Ready for Your Appointment`;

  const checklistItems = [
    { icon: "&#128196;", title: "Gather your documents", desc: "Collect all contracts, correspondence, receipts, or legal notices related to your matter." },
    { icon: "&#128221;", title: "Write down your questions", desc: "List the top 3–5 questions or concerns you want to address during our consultation." },
    { icon: "&#128337;", title: "Block your calendar", desc: `Reserve ${bookingDate ? bookingDate : "the consultation time"} and add a 15-minute buffer before and after.` },
    { icon: "&#128241;", title: "Test your technology", desc: meetingLocation ? `Ensure your video/audio works for the meeting at: ${meetingLocation}` : "Ensure your phone or video connection is working and you have a quiet space." },
    { icon: "&#128203;", title: "Review your situation summary", desc: "Prepare a 2–3 minute summary of your legal matter so we can use our time efficiently." },
    { icon: "&#128274;", title: "Secure your documents", desc: "Upload any sensitive documents to your client portal before the consultation for easy reference." },
  ];

  const bodyRows = `
    <tr>
      <td style="padding:32px 36px 0;">
        <span style="display:inline-block;background-color:${brand.primary};color:${brand.accent};font-size:10px;font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;padding:4px 14px;border-radius:20px;margin-bottom:22px;font-family:Georgia,serif;">&#9989;&nbsp; Pre-Consultation Checklist</span>
        <h2 style="margin:0 0 20px;font-size:21px;color:${brand.foreground};font-family:Georgia,'Times New Roman',serif;font-weight:normal;letter-spacing:-0.01em;border-bottom:1px solid ${brand.border};padding-bottom:14px;">Prepare for your upcoming consultation</h2>
      </td>
    </tr>
    <tr>
      <td style="padding:0 36px 32px;">
        <p style="margin:0 0 16px;font-size:15px;color:${brand.foreground};line-height:1.8;font-family:Georgia,serif;">Dear ${firstName},</p>
        <p style="margin:0 0 24px;font-size:15px;color:${brand.foreground};line-height:1.8;font-family:Georgia,serif;">
          Your <strong>${service}</strong> consultation is coming up${bookingDate ? ` on <strong>${bookingDate}</strong>${bookingTime ? ` at <strong>${bookingTime}</strong>` : ""}` : " soon"}. Use this checklist to make sure you're fully prepared.
        </p>

        <!-- Checklist -->
        ${checklistItems.map((item, i) => `
        <div style="display:flex;margin-bottom:14px;background-color:${i % 2 === 0 ? brand.bgCard : brand.bg};border:1px solid ${brand.border};border-radius:10px;padding:16px 20px;align-items:flex-start;">
          <div style="width:36px;height:36px;border-radius:50%;background-color:${brand.accentLight};color:${brand.accent};font-size:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-right:14px;text-align:center;line-height:36px;">${item.icon}</div>
          <div>
            <p style="margin:0 0 4px;font-size:14px;font-weight:bold;color:${brand.foreground};font-family:Georgia,serif;">${item.title}</p>
            <p style="margin:0;font-size:13px;color:${brand.muted};line-height:1.7;font-family:Georgia,serif;">${item.desc}</p>
          </div>
        </div>`).join("")}

        <!-- Appointment Reminder -->
        ${bookingDate || meetingLocation ? `
        <div style="background-color:${brand.accentLight};border:1px solid rgba(200,150,90,0.3);border-radius:10px;padding:20px 24px;margin:24px 0 28px;">
          <p style="margin:0 0 12px;font-size:12px;font-weight:bold;color:${brand.primary};font-family:Georgia,serif;letter-spacing:0.06em;text-transform:uppercase;">&#128197;&nbsp; Your Appointment</p>
          ${bookingDate ? `<p style="margin:0 0 6px;font-size:14px;color:${brand.foreground};font-family:Georgia,serif;"><strong>Date:</strong> ${bookingDate}</p>` : ""}
          ${bookingTime ? `<p style="margin:0 0 6px;font-size:14px;color:${brand.foreground};font-family:Georgia,serif;"><strong>Time:</strong> ${bookingTime}</p>` : ""}
          ${meetingLocation ? `<p style="margin:0;font-size:14px;color:${brand.foreground};font-family:Georgia,serif;"><strong>Meeting:</strong> <a href="${meetingLocation}" style="color:${brand.accent};">${meetingLocation}</a></p>` : ""}
        </div>` : ""}

        <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 28px;">
          <tr>
            <td style="background-color:${brand.accent};border-radius:8px;box-shadow:0 3px 12px rgba(200,150,90,0.35);">
              <a href="${SITE_URL}/portal/dashboard" style="display:inline-block;padding:14px 36px;color:${brand.white};text-decoration:none;font-size:14px;font-family:Georgia,serif;letter-spacing:0.05em;font-weight:bold;">Open Client Portal &rarr;</a>
            </td>
          </tr>
        </table>

        <table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:28px;border-top:1px solid ${brand.border};padding-top:20px;width:100%;">
          <tr><td>
            <p style="margin:0 0 4px;font-size:15px;color:${brand.foreground};font-family:Georgia,serif;">Looking forward to our conversation,</p>
            <p style="margin:0 0 2px;font-size:16px;color:${brand.primary};font-weight:bold;font-family:Georgia,serif;">Broussard Legal Services</p>
            <p style="margin:0 0 6px;font-size:12px;color:${brand.muted};font-family:Georgia,serif;letter-spacing:0.04em;">Licensed Paralegal &middot; Louisiana &amp; Nationwide</p>
            <a href="mailto:maggimaybroussard@gmail.com" style="color:${brand.accent};font-size:13px;text-decoration:none;font-family:Georgia,serif;">maggimaybroussard@gmail.com</a>
          </td></tr>
        </table>
      </td>
    </tr>`;

  return { subject, html: wrapEmail("Your pre-consultation checklist — get ready for your appointment.", bodyRows) };
}

// ── 4. Post-Consultation Follow-Up ─────────────────────────────────────────
function buildPostConsultationFollowUpEmail(params: {
  firstName: string;
  service: string;
  outcome?: "attended" | "no_show";
  customMessage?: string;
  nextSteps?: string[];
}): { subject: string; html: string } {
  const { firstName, service, outcome, customMessage, nextSteps } = params;
  const isNoShow = outcome === "no_show";

  const subject = isNoShow
    ? `We Missed You — Reschedule Your ${service} Consultation`
    : `Follow-Up: Your ${service} Consultation — Next Steps`;

  const defaultNextSteps = nextSteps && nextSteps.length > 0 ? nextSteps : [
    "Review the information and documents we discussed",
    "Upload any additional materials to your client portal",
    "Reach out if you have questions or new developments arise",
    "Book a follow-up consultation if needed",
  ];

  const bodyRows = isNoShow ? `
    <tr>
      <td style="padding:32px 36px 0;">
        <span style="display:inline-block;background-color:#8B6914;color:${brand.white};font-size:10px;font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;padding:4px 14px;border-radius:20px;margin-bottom:22px;font-family:Georgia,serif;">&#128337;&nbsp; Missed Appointment</span>
        <h2 style="margin:0 0 20px;font-size:21px;color:${brand.foreground};font-family:Georgia,'Times New Roman',serif;font-weight:normal;letter-spacing:-0.01em;border-bottom:1px solid ${brand.border};padding-bottom:14px;">We missed you — let's reschedule</h2>
      </td>
    </tr>
    <tr>
      <td style="padding:0 36px 32px;">
        <p style="margin:0 0 16px;font-size:15px;color:${brand.foreground};line-height:1.8;font-family:Georgia,serif;">Dear ${firstName},</p>
        <p style="margin:0 0 20px;font-size:15px;color:${brand.foreground};line-height:1.8;font-family:Georgia,serif;">
          We noticed you were unable to attend your scheduled <strong>${service}</strong> consultation. We completely understand that things come up, and we would love to find a time that works better for you.
        </p>
        ${customMessage ? `<p style="margin:0 0 20px;font-size:15px;color:${brand.foreground};line-height:1.8;font-family:Georgia,serif;">${customMessage}</p>` : ""}
        <div style="background-color:${brand.accentLight};border:1px solid rgba(200,150,90,0.3);border-radius:10px;padding:20px 24px;margin:0 0 28px;">
          <p style="margin:0 0 12px;font-size:13px;font-weight:bold;color:${brand.primary};font-family:Georgia,serif;">Your consultation deposit remains on file and will be applied to your rescheduled appointment.</p>
          <p style="margin:0;font-size:14px;color:${brand.muted};font-family:Georgia,serif;line-height:1.7;">Simply click the button below to choose a new time that works for you.</p>
        </div>
        <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 28px;">
          <tr>
            <td style="background-color:${brand.accent};border-radius:8px;box-shadow:0 3px 12px rgba(200,150,90,0.35);">
              <a href="${SITE_URL}/book-consultation" style="display:inline-block;padding:14px 36px;color:${brand.white};text-decoration:none;font-size:14px;font-family:Georgia,serif;letter-spacing:0.05em;font-weight:bold;">Reschedule Your Consultation &rarr;</a>
            </td>
          </tr>
        </table>
        <table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:28px;border-top:1px solid ${brand.border};padding-top:20px;width:100%;">
          <tr><td>
            <p style="margin:0 0 4px;font-size:15px;color:${brand.foreground};font-family:Georgia,serif;">Warm regards,</p>
            <p style="margin:0 0 2px;font-size:16px;color:${brand.primary};font-weight:bold;font-family:Georgia,serif;">Broussard Legal Services</p>
            <p style="margin:0 0 6px;font-size:12px;color:${brand.muted};font-family:Georgia,serif;letter-spacing:0.04em;">Licensed Paralegal &middot; Louisiana &amp; Nationwide</p>
            <a href="mailto:maggimaybroussard@gmail.com" style="color:${brand.accent};font-size:13px;text-decoration:none;font-family:Georgia,serif;">maggimaybroussard@gmail.com</a>
          </td></tr>
        </table>
      </td>
    </tr>` : `
    <tr>
      <td style="padding:32px 36px 0;">
        <span style="display:inline-block;background-color:${brand.accent};color:${brand.white};font-size:10px;font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;padding:4px 14px;border-radius:20px;margin-bottom:22px;font-family:Georgia,serif;">&#9654;&nbsp; Post-Consultation Follow-Up</span>
        <h2 style="margin:0 0 20px;font-size:21px;color:${brand.foreground};font-family:Georgia,'Times New Roman',serif;font-weight:normal;letter-spacing:-0.01em;border-bottom:1px solid ${brand.border};padding-bottom:14px;">Thank you — here are your next steps</h2>
      </td>
    </tr>
    <tr>
      <td style="padding:0 36px 32px;">
        <p style="margin:0 0 16px;font-size:15px;color:${brand.foreground};line-height:1.8;font-family:Georgia,serif;">Dear ${firstName},</p>
        <p style="margin:0 0 20px;font-size:15px;color:${brand.foreground};line-height:1.8;font-family:Georgia,serif;">
          Thank you for your <strong>${service}</strong> consultation. It was a pleasure speaking with you, and I want to make sure you have everything you need to move forward with confidence.
        </p>
        ${customMessage ? `<p style="margin:0 0 20px;font-size:15px;color:${brand.foreground};line-height:1.8;font-family:Georgia,serif;">${customMessage}</p>` : ""}

        <!-- Next Steps -->
        <div style="background-color:${brand.bgCard};border:1px solid ${brand.border};border-radius:10px;overflow:hidden;margin:0 0 24px;">
          <div style="background-color:${brand.primary};padding:12px 22px;">
            <p style="margin:0;font-size:11px;color:${brand.accent};font-weight:bold;text-transform:uppercase;letter-spacing:0.12em;font-family:Georgia,serif;">&#9654;&nbsp; Your Recommended Next Steps</p>
          </div>
          <div style="padding:16px 22px;">
            ${defaultNextSteps.map((step, i) => `
            <div style="display:flex;margin-bottom:${i < defaultNextSteps.length - 1 ? "12px" : "0"};align-items:flex-start;">
              <div style="width:24px;height:24px;border-radius:50%;background-color:${brand.accent};color:${brand.white};font-size:12px;font-weight:bold;font-family:Georgia,serif;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-right:12px;text-align:center;line-height:24px;">${i + 1}</div>
              <p style="margin:0;font-size:14px;color:${brand.foreground};line-height:1.7;font-family:Georgia,serif;padding-top:2px;">${step}</p>
            </div>`).join("")}
          </div>
        </div>

        <!-- Portal CTA -->
        <div style="background-color:${brand.accentLight};border:1px solid rgba(200,150,90,0.3);border-radius:10px;padding:20px 24px;margin:0 0 28px;">
          <p style="margin:0 0 8px;font-size:13px;font-weight:bold;color:${brand.primary};font-family:Georgia,serif;">Your client portal is ready</p>
          <p style="margin:0 0 14px;font-size:14px;color:${brand.muted};font-family:Georgia,serif;line-height:1.7;">Access your case documents, send secure messages, track invoices, and monitor your case status — all in one place.</p>
          <table cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td style="background-color:${brand.accent};border-radius:7px;">
                <a href="${SITE_URL}/portal/dashboard" style="display:inline-block;padding:12px 28px;color:${brand.white};text-decoration:none;font-size:13px;font-family:Georgia,serif;letter-spacing:0.05em;font-weight:bold;">Open Client Portal &rarr;</a>
              </td>
            </tr>
          </table>
        </div>

        <table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:28px;border-top:1px solid ${brand.border};padding-top:20px;width:100%;">
          <tr><td>
            <p style="margin:0 0 4px;font-size:15px;color:${brand.foreground};font-family:Georgia,serif;">With dedication,</p>
            <p style="margin:0 0 2px;font-size:16px;color:${brand.primary};font-weight:bold;font-family:Georgia,serif;">Broussard Legal Services</p>
            <p style="margin:0 0 6px;font-size:12px;color:${brand.muted};font-family:Georgia,serif;letter-spacing:0.04em;">Licensed Paralegal &middot; Louisiana &amp; Nationwide</p>
            <a href="mailto:maggimaybroussard@gmail.com" style="color:${brand.accent};font-size:13px;text-decoration:none;font-family:Georgia,serif;">maggimaybroussard@gmail.com</a>
          </td></tr>
        </table>
      </td>
    </tr>`;

  return { subject, html: wrapEmail(isNoShow ? `We missed you — let's reschedule your ${service} consultation.` : `Your ${service} consultation follow-up — next steps inside.`, bodyRows) };
}

// ── Main Handler ───────────────────────────────────────────────────────────
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
      emailType,
      inquiryId,
      clientEmail,
      clientName,
      service,
      // payment_confirmation fields
      amount,
      paymentDate,
      invoiceId,
      // shared booking fields
      bookingDate,
      bookingTime,
      meetingLocation,
      // prep_documents fields
      prepLink,
      documents,
      // post_consultation_followup fields
      outcome,
      customMessage,
      nextSteps,
    } = body;

    if (!emailType || !clientEmail || !clientName) {
      throw new Error("Missing required fields: emailType, clientEmail, clientName");
    }

    const RESEND_API_KEY = (globalThis as any)?.Deno?.env?.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");

    const SUPABASE_URL = (globalThis as any)?.Deno?.env?.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = (globalThis as any)?.Deno?.env?.get("SUPABASE_SERVICE_ROLE_KEY");

    const firstName = clientName.split(" ")[0] ?? clientName;
    const serviceName = service ?? "Legal Services";

    let emailPayload: { subject: string; html: string };

    switch (emailType) {
      case "payment_confirmation":
        emailPayload = buildPaymentConfirmationEmail({
          firstName,
          service: serviceName,
          amount: amount ?? "$0.00",
          paymentDate: paymentDate ?? new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
          invoiceId,
          bookingDate,
          bookingTime,
          meetingLocation,
        });
        break;

      case "prep_documents":
        emailPayload = buildPrepDocumentsEmail({
          firstName,
          service: serviceName,
          bookingDate,
          bookingTime,
          meetingLocation,
          prepLink,
          documents,
        });
        break;

      case "pre_consultation_checklist":
        emailPayload = buildPreConsultationChecklistEmail({
          firstName,
          service: serviceName,
          bookingDate,
          bookingTime,
          meetingLocation,
        });
        break;

      case "post_consultation_followup":
        emailPayload = buildPostConsultationFollowUpEmail({
          firstName,
          service: serviceName,
          outcome,
          customMessage,
          nextSteps,
        });
        break;

      default:
        throw new Error(`Unknown emailType: ${emailType}. Valid types: payment_confirmation, prep_documents, pre_consultation_checklist, post_consultation_followup`);
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
        to: [clientEmail],
        subject: emailPayload.subject,
        html: emailPayload.html,
      }),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.json();
      throw new Error(errBody.message || "Resend API error");
    }

    const resendData = await resendRes.json();

    // Log to DB if Supabase credentials available
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && inquiryId) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        await supabase.from("consultation_onboarding_email_logs").insert({
          inquiry_id: inquiryId,
          email_type: emailType,
          recipient_email: clientEmail,
          recipient_name: clientName,
          subject: emailPayload.subject,
          resend_id: resendData.id ?? null,
          sent_at: new Date().toISOString(),
          status: "sent",
          metadata: { service: serviceName, outcome: outcome ?? null },
        });
      } catch {
        // Non-blocking log failure
      }
    }

    return new Response(
      JSON.stringify({ success: true, emailType, resendId: resendData.id }),
      { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  }
});
